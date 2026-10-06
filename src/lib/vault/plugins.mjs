// remark plugins that teach unified about Obsidian's markdown dialect.
//
//   [[Note]] [[Note|alias]] [[Note#Heading]]   -> links (plain text if the target isn't published)
//   ![[image.png|300]]  ![](_attachments/x.png) -> images resolved next to the note, copied to the site
//   > [!tip]+ Title                             -> callouts (foldable with + / -)
//   ==highlight==                               -> <mark>
//   ![](https://youtu.be/...)                   -> privacy-friendly YouTube embed
//
// Because this works on the syntax tree, code blocks and inline code are never touched.

import path from 'node:path';
import { visit, SKIP } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';
import { noteUrl } from './scan.mjs';

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'ogv']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac']);

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isExternal = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//');
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const extOf = (p) => path.extname(p.split('#')[0]).slice(1).toLowerCase();

// ---------------------------------------------------------------- YouTube

function parseTime(t) {
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function parseYoutube(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') {
    id = u.pathname.slice(1);
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else id = /^\/(?:embed|shorts|live|v)\/([^/?]+)/.exec(u.pathname)?.[1] ?? null;
  }
  if (!id || !/^[\w-]{6,}$/.test(id)) return null;
  const t = u.searchParams.get('t') ?? u.searchParams.get('start');
  return { id, start: t ? parseTime(t) : 0 };
}

function youtubeHtml({ id, start }, title) {
  const qs = start ? `?start=${start}` : '';
  return (
    `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}${qs}" ` +
    `title="${esc(title || 'YouTube video')}" loading="lazy" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
    `referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`
  );
}

// ---------------------------------------------------------------- main plugin

/**
 * @param {{ note: import('./scan.mjs').Note, vault: ReturnType<typeof import('./scan.mjs').scanVault>, emitAsset: (abs: string, slug: string) => string }} opts
 */
export function remarkObsidian({ note, vault, emitAsset }) {
  const warn = (msg) => vault.warn(`[vault] ${note.relPath}: ${msg}`);
  // CI logs may be public: never print the names of notes that are NOT published.
  const redact = Boolean(process.env.CI);

  const noteTitle = (n) => n?.data?.title ?? n?.name ?? '';

  // -- [[wikilinks]] ----------------------------------------------------
  function wikilink(inner) {
    const [rawTarget, ...aliasParts] = inner.split('|');
    const alias = aliasParts.join('|').trim() || null;
    const hashAt = rawTarget.indexOf('#');
    const page = (hashAt === -1 ? rawTarget : rawTarget.slice(0, hashAt)).trim();
    const heading = hashAt === -1 ? '' : rawTarget.slice(hashAt + 1).trim();
    const isBlockRef = heading.startsWith('^');

    const target = page ? vault.findNote(page, note) : note;
    let label = alias;
    if (!label) {
      if (!page) label = heading;
      else if (heading && !isBlockRef) label = `${target ? noteTitle(target) : page} › ${heading}`;
      else label = target ? noteTitle(target) : page;
    }

    if (target?.published) {
      const frag = heading && !isBlockRef ? `#${new GithubSlugger().slug(heading)}` : '';
      const url = (page ? noteUrl(target) : '') + frag;
      return [{ type: 'link', url, title: null, children: [{ type: 'text', value: label }] }];
    }
    if (page) {
      warn(
        redact
          ? 'a wikilink points to an unpublished or missing note; rendering as plain text'
          : `[[${page}]] points to ${target ? 'an unpublished note' : 'a note that does not exist'}; rendering as plain text`,
      );
    }
    return [{ type: 'text', value: label }];
  }

  // -- ![[embeds]] ------------------------------------------------------
  function embed(inner) {
    const [rawTarget, ...parts] = inner.split('|');
    const target = rawTarget.trim();
    const ext = extOf(target);

    let width;
    let height;
    let alt = '';
    for (const part of parts.map((p) => p.trim())) {
      const size = /^(\d+)(?:x(\d+))?$/.exec(part);
      if (size) {
        width = Number(size[1]);
        height = size[2] ? Number(size[2]) : undefined;
      } else if (part) alt = part;
    }

    if (IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext) || ext === 'pdf') {
      const abs = vault.findAttachment(target, note);
      if (!abs) {
        warn(`attachment not found: ${target}`);
        return [];
      }
      const url = emitAsset(abs, note.slug);
      if (IMAGE_EXT.has(ext)) {
        return [
          {
            type: 'image',
            url,
            alt, // empty unless the author wrote one: ![[img.png|describe it|300]]
            data: { hProperties: { ...(width && { width }), ...(height && { height }), loading: 'lazy', decoding: 'async' } },
          },
        ];
      }
      if (VIDEO_EXT.has(ext)) return [{ type: 'html', value: `<video controls preload="metadata" src="${esc(url)}"></video>` }];
      if (AUDIO_EXT.has(ext)) return [{ type: 'html', value: `<audio controls preload="metadata" src="${esc(url)}"></audio>` }];
      return [{ type: 'link', url, title: null, children: [{ type: 'text', value: alt || path.basename(target) }] }];
    }

    // Embedding another note: link to it rather than transcluding it.
    const other = vault.findNote(target.split('#')[0], note);
    if (other?.published) {
      return [{ type: 'link', url: noteUrl(other), title: null, children: [{ type: 'text', value: noteTitle(other) }] }];
    }
    warn(redact ? 'an embedded note is not published; skipped' : `embedded note "${target}" is not published; skipped`);
    return [];
  }

  // -- callouts ---------------------------------------------------------
  function callouts(tree) {
    visit(tree, 'blockquote', (node) => {
      if (node.data?.calloutDone) return;
      const first = node.children[0];
      if (first?.type !== 'paragraph') return;
      const text = first.children[0];
      if (text?.type !== 'text') return;
      const m = /^\[!([A-Za-z0-9_-]+)\]([+-]?)[ \t]*([^\n]*)(?:\n|$)/.exec(text.value);
      if (!m) return;

      const type = m[1].toLowerCase();
      const fold = m[2];
      const title = m[3].trim() || titleCase(type);
      const rest = text.value.slice(m[0].length);

      if (rest) text.value = rest;
      else if (first.children.length === 1) node.children.shift();
      else first.children.shift();

      const foldable = fold === '+' || fold === '-';
      const titleNode = {
        type: 'paragraph',
        data: { hName: foldable ? 'summary' : 'div', hProperties: { className: ['callout-title'] } },
        children: [{ type: 'text', value: title }],
      };
      const body = {
        type: 'blockquote',
        data: { calloutDone: true, hName: 'div', hProperties: { className: ['callout-content'] } },
        children: node.children,
      };
      node.children = [titleNode, body];
      node.data = {
        calloutDone: true,
        hName: foldable ? 'details' : 'div',
        hProperties: { className: ['callout'], dataCallout: type, ...(fold === '+' && { open: true }) },
      };
    });
  }

  // -- inline text: wikilinks, embeds, ==highlight== ----------------------
  const INLINE = /(!?)\[\[([^[\]\n]+?)\]\]|==([^\s=](?:[^=\n]*?[^\s=])?)==/g;

  function inlineText(tree) {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('[[') && !node.value.includes('==')) return;
      const out = [];
      let last = 0;
      for (const m of node.value.matchAll(INLINE)) {
        if (m.index > last) out.push({ type: 'text', value: node.value.slice(last, m.index) });
        if (m[3] !== undefined) {
          out.push({
            type: 'emphasis',
            data: { hName: 'mark' },
            children: [{ type: 'text', value: m[3] }],
          });
        } else if (m[1] === '!') {
          out.push(...embed(m[2]));
        } else {
          out.push(...wikilink(m[2]));
        }
        last = m.index + m[0].length;
      }
      if (!out.length) return;
      if (last < node.value.length) out.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  }

  // -- standard markdown: youtube, images, relative links ------------------
  function standard(tree) {
    // A paragraph that is only an image pointing at YouTube becomes an embed.
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || node.children.length !== 1 || node.children[0].type !== 'image') return;
      const img = node.children[0];
      const yt = parseYoutube(img.url);
      if (!yt) return;
      parent.children[index] = { type: 'html', value: youtubeHtml(yt, img.alt) };
      return [SKIP, index + 1];
    });

    visit(tree, 'image', (node) => {
      const url = node.url ?? '';
      // Obsidian sizes standard images as ![alt|300](...)
      const sized = /^(.*?)(?:\|(\d+)(?:x(\d+))?)?$/.exec(node.alt ?? '');
      node.alt = sized?.[1] ?? node.alt ?? '';
      const props = { loading: 'lazy', decoding: 'async' };
      if (sized?.[2]) props.width = Number(sized[2]);
      if (sized?.[3]) props.height = Number(sized[3]);
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, ...props } };

      if (!url || url.startsWith('/') || isExternal(url)) return;
      const abs = vault.findAttachment(url, note);
      if (abs) node.url = emitAsset(abs, note.slug);
      else warn(`image not found: ${url}`);
    });

    visit(tree, 'link', (node, index, parent) => {
      const url = node.url ?? '';
      if (!parent || index === undefined) return;
      if (!url || url.startsWith('#') || url.startsWith('/') || isExternal(url)) return;
      const hashAt = url.indexOf('#');
      const file = hashAt === -1 ? url : url.slice(0, hashAt);
      const hash = hashAt === -1 ? '' : url.slice(hashAt);

      if (/\.md$/i.test(file)) {
        const target = vault.findNote(file, note);
        if (target?.published) {
          node.url = noteUrl(target) + hash;
          return;
        }
        warn(
          redact
            ? 'a link points to an unpublished or missing note; rendering as plain text'
            : `link to ${file} points to an unpublished or missing note; rendering as plain text`,
        );
        parent.children.splice(index, 1, ...node.children);
        return [SKIP, index];
      }
      const abs = vault.findAttachment(file, note);
      if (abs) node.url = emitAsset(abs, note.slug);
    });
  }

  return (tree) => {
    callouts(tree);
    inlineText(tree);
    standard(tree);
  };
}

// ---------------------------------------------------------------- title + excerpt

/**
 * If the note opens with `# Heading`, use it as the title and drop it from the
 * body (the page template renders the title itself). A heading that differs from
 * an explicit frontmatter title is kept as ordinary content.
 */
export function remarkTitle({ frontTitle } = {}) {
  return (tree, file) => {
    const first = tree.children[0];
    if (first?.type !== 'heading' || first.depth !== 1) return;
    const text = toString(first).trim();
    file.data.h1 = text;
    if (!frontTitle || frontTitle.trim().toLowerCase() === text.toLowerCase()) {
      tree.children.shift();
    }
  };
}

/** Plain-text first paragraph, used as the description when none is given. */
export function remarkExcerpt() {
  return (tree, file) => {
    for (const node of tree.children) {
      if (node.type !== 'paragraph') continue;
      const text = toString({
        type: 'paragraph',
        children: node.children.filter((c) => c.type !== 'image' && c.type !== 'html'),
      })
        .replace(/\s+/g, ' ')
        .trim();
      if (text) {
        file.data.excerpt = text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
        return;
      }
    }
  };
}
