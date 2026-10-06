// Scans an Obsidian vault (or any folder of markdown) and builds the indexes
// needed to resolve wikilinks and attachments.
//
// Nothing in here touches Astro, so it can be unit-tested with `node --test`.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

export const POSTS_BASE = '/posts';
export const postUrl = (slug) => `${POSTS_BASE}/${slug}/`;
export const PROJECTS_BASE = '/projects';
export const projectUrl = (slug) => `${PROJECTS_BASE}/${slug}/`;

/**
 * `type: page` notes (About, etc.) live at /<slug>/, `type: project` notes at /projects/<slug>/,
 * everything else at /posts/<slug>/.
 */
export const noteUrl = (note) => {
  const type = note.data?.type;
  if (type === 'page') return `/${note.slug}/`;
  if (type === 'project') return projectUrl(note.slug);
  return postUrl(note.slug);
};

// Top-level routes that a page slug must never shadow.
const RESERVED_PAGE_SLUGS = new Set(['posts', 'projects', 'media', '404']);

export function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const toPosix = (p) => p.split(path.sep).join('/');
const stripMd = (p) => p.replace(/\.md$/i, '');

/** `publish: true` (or `published: true`) is the only way a note goes live. */
export function isPublished(data) {
  const v = data?.publish ?? data?.published;
  if (v === true) return true;
  if (typeof v === 'string') return ['true', 'yes'].includes(v.trim().toLowerCase());
  return false;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // .git, .obsidian, .trash, .github ... and node_modules are never content.
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

/**
 * @typedef {object} Note
 * @property {string} absPath
 * @property {string} relPath   posix path relative to the vault root
 * @property {string} dir       absolute directory of the note
 * @property {string} name      filename without extension
 * @property {Record<string, any>} data  frontmatter
 * @property {string} body      markdown without frontmatter
 * @property {boolean} published
 * @property {string} slug
 */

export function scanVault(rootInput, { warn = console.warn } = {}) {
  const root = path.resolve(rootInput);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`[vault] content directory not found: ${root}`);
  }

  /** @type {Note[]} */
  const notes = [];
  /** @type {Map<string, string[]>} lowercase basename -> absolute paths */
  const attachments = new Map();

  for (const absPath of walk(root)) {
    if (/\.md$/i.test(absPath)) {
      const relPath = toPosix(path.relative(root, absPath));
      const name = path.basename(absPath).replace(/\.md$/i, '');
      let data = {};
      let body = '';
      try {
        const parsed = matter(fs.readFileSync(absPath, 'utf8'));
        data = parsed.data ?? {};
        body = parsed.content;
      } catch (err) {
        // A note with broken YAML is treated as unpublished, never as a build failure.
        warn(
          process.env.CI
            ? '[vault] a note has invalid frontmatter and was skipped (run the build locally to see which)'
            : `[vault] could not parse frontmatter in ${relPath}: ${err.message}`,
        );
        continue;
      }
      const published = isPublished(data);
      const slug = slugify(data.slug ?? name) || slugify(relPath);
      notes.push({ absPath, relPath, dir: path.dirname(absPath), name, data, body, published, slug });
    } else {
      const key = path.basename(absPath).toLowerCase();
      if (!attachments.has(key)) attachments.set(key, []);
      attachments.get(key).push(absPath);
    }
  }

  const publishedNotes = notes.filter((n) => n.published);

  // Two published notes must never fight over one URL.
  const seen = new Map();
  for (const n of publishedNotes) {
    if (n.data.type === 'page' && RESERVED_PAGE_SLUGS.has(n.slug)) {
      throw new Error(
        `[vault] ${n.relPath}: "${n.slug}" is reserved by the site and can't be used as a page slug. ` +
          `Set a different \`slug\` property.`,
      );
    }
    if (seen.has(n.slug)) {
      throw new Error(
        `[vault] duplicate slug "${n.slug}": ${seen.get(n.slug).relPath} and ${n.relPath}. ` +
          `Set a unique \`slug\` property on one of them.`,
      );
    }
    seen.set(n.slug, n);
  }

  /** @type {Map<string, Note[]>} */
  const byName = new Map();
  /** @type {Map<string, Note>} */
  const byPath = new Map();
  for (const n of notes) {
    const key = n.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(n);
    byPath.set(stripMd(n.relPath).toLowerCase(), n);
  }

  const inside = (abs) => abs === root || abs.startsWith(root + path.sep);

  /** Resolve `[[Target]]` / `Target.md` the way Obsidian does. */
  function findNote(target, fromNote) {
    let t = stripMd(String(target).trim());
    try {
      t = decodeURIComponent(t);
    } catch {
      /* keep as is */
    }
    if (!t) return null;
    if (t.includes('/')) {
      const rel = toPosix(path.relative(root, path.resolve(fromNote?.dir ?? root, t))).toLowerCase();
      return byPath.get(t.replace(/^\.?\//, '').toLowerCase()) ?? byPath.get(rel) ?? null;
    }
    const matches = byName.get(t.toLowerCase());
    if (!matches?.length) return null;
    if (matches.length === 1 || !fromNote) return matches[0];
    return matches.find((m) => m.dir === fromNote.dir) ?? matches[0];
  }

  /**
   * Resolve an attachment reference (`foo.png`, `_attachments/foo.png`, `a%20b.png`)
   * to an absolute path inside the vault. Anything that would escape the vault is refused.
   */
  function findAttachment(target, fromNote) {
    let t = String(target).trim();
    try {
      t = decodeURIComponent(t);
    } catch {
      /* keep as is */
    }
    t = t.replace(/^<|>$/g, '').replace(/^\.\//, '');
    if (!t) return null;
    const base = path.basename(t);
    const candidates = [
      path.resolve(fromNote?.dir ?? root, t),
      path.resolve(fromNote?.dir ?? root, '_attachments', base),
      path.resolve(root, t),
    ];
    for (const c of candidates) {
      if (inside(c) && fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    const indexed = attachments.get(base.toLowerCase());
    if (indexed?.length) {
      if (indexed.length === 1 || !fromNote) return indexed[0];
      // Prefer the copy nearest to the note.
      return [...indexed].sort(
        (a, b) => commonPrefix(b, fromNote.dir) - commonPrefix(a, fromNote.dir),
      )[0];
    }
    return null;
  }

  return { root, notes, published: publishedNotes, findNote, findAttachment, warn };
}

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Date the file first entered git history, if the vault is a git checkout. */
export function gitFirstCommitDate(root, relPath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', relPath],
      { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    const last = out.at(-1);
    const d = last ? new Date(last) : null;
    return d && !Number.isNaN(d.valueOf()) ? d : null;
  } catch {
    return null;
  }
}

/** frontmatter -> Date. Accepts Date objects and most date strings. */
export function coerceDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.valueOf()) ? null : d;
}
