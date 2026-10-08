// LinkedIn drafts: after a new post goes live, a GitHub issue in the (private) content repo holds the text to
// post. The draft is written in the note itself, in an Obsidian comment (removed from the published page):
//
//   %% linkedin
//   Your hook and a few lines...
//   %%
//
// Everything here is plain functions (the network is passed in), so `node --test` covers it.
// Used by scripts/linkedin-drafts.mjs, which the deploy workflow runs.

export const LABEL = 'linkedin-draft';
export const LINKEDIN_LIMIT = 3000; // characters in a LinkedIn post
export const PREVIEW_TOOL = 'https://linkedinpreview.com/dashboard'; // paste the text in to see how the post will look
const marker = (slug) => `<!-- linkedin-draft:${slug} -->`;

/**
 * The text of every Obsidian comment (`%% ... %%`, inline or spanning lines) outside code, using the same rules
 * as stripComments() in vault/comments.mjs, which removes them from the page.
 */
export function findComments(text) {
  const found = [];
  let fence = null;
  let inComment = false;
  let current = [];

  for (const line of text.split('\n')) {
    if (!inComment) {
      const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (fence) {
        if (m && m[1][0] === fence[0] && m[1].length >= fence.length && /^\s{0,3}(`+|~+)\s*$/.test(line)) fence = null;
        continue;
      }
      if (m) {
        fence = m[1];
        continue;
      }
    }

    let buf = '';
    let i = 0;
    while (i < line.length) {
      if (inComment) {
        const j = line.indexOf('%%', i);
        if (j === -1) {
          buf += line.slice(i);
          i = line.length;
        } else {
          buf += line.slice(i, j);
          current.push(buf);
          found.push(current.join('\n'));
          current = [];
          buf = '';
          inComment = false;
          i = j + 2;
        }
        continue;
      }
      if (line[i] === '`') {
        const run = /^`+/.exec(line.slice(i))[0];
        const end = line.indexOf(run, i + run.length);
        i = end === -1 ? line.length : end + run.length;
        continue;
      }
      if (line.startsWith('%%', i)) {
        inComment = true;
        i += 2;
        continue;
      }
      i++;
    }
    if (inComment) current.push(buf);
  }
  return found;
}

/** The post text from the first `%% linkedin ... %%` comment, or null if there is none or it is empty. */
export function extractLinkedinDraft(body) {
  for (const comment of findComments(String(body ?? '').replace(/\r\n/g, '\n'))) {
    const m = /^\s*linkedin(?![\w-])\s*:?([\s\S]*)$/i.exec(comment);
    if (!m) continue;
    const text = m[1]
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text || null;
  }
  return null;
}

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Slugs of the posts in a sitemap (`/posts/<slug>/`), or null if the text is not a sitemap at all. */
export function parsePostSlugs(xml) {
  if (!/<urlset[\s>]/.test(String(xml))) return null;
  const slugs = new Set();
  for (const [, loc] of String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    let pathname;
    try {
      pathname = new URL(loc).pathname;
    } catch {
      continue;
    }
    const m = /^\/posts\/([^/]+)\/$/.exec(pathname);
    if (m) slugs.add(safeDecode(m[1]));
  }
  return slugs;
}

/** Built posts that were not live yet, in a stable order. Without a baseline (null) nothing counts as new. */
export function newSlugs(live, built) {
  if (!live || !built) return [];
  return [...built].filter((s) => !live.has(s)).sort();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[e.toLowerCase()] ?? whole;
  });
}

/** Title and description of a built page, from its <meta> tags (quoted or not: the HTML is minified). */
export function readPostMeta(html, siteTitle = '') {
  const meta = {};
  for (const [, attrs] of String(html).matchAll(/<meta\s+([^>]*?)\/?>/gi)) {
    const a = {};
    for (const [, k, dq, sq, bare] of attrs.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      a[k.toLowerCase()] = dq ?? sq ?? bare;
    }
    const key = a.property ?? a.name;
    if (key && a.content !== undefined && !(key in meta)) meta[key] = decodeEntities(a.content);
  }
  let title = meta['og:title'] ?? '';
  const suffix = siteTitle ? ` · ${siteTitle}` : '';
  if (suffix && title.endsWith(suffix)) title = title.slice(0, -suffix.length);
  return { title, description: meta['og:description'] ?? meta.description ?? '' };
}

/** What gets posted when the note has no `%% linkedin %%` block. */
export function fallbackDraft({ title, description }) {
  return [title, description].filter(Boolean).join('\n\n');
}

/** A code fence longer than any run of backticks inside, so the draft can be copied exactly as written. */
function fenced(text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${text}\n${fence}`;
}

export function buildIssue({ slug, title, url, cardUrl, draft, hasOwnDraft }) {
  const text = draft ?? '';
  const lines = [
    `**${title}** is live: ${url}`,
    '',
    '### Post text',
    hasOwnDraft
      ? 'From the `%% linkedin %%` block in the note. Copy it with the button on the code block.'
      : 'The note has no `%% linkedin %%` block, so this is the title and description. Rewrite it before posting.',
    '',
    fenced(text),
    '',
    `To see how it will look in the feed, paste it into [LinkedIn Preview](${PREVIEW_TOOL}).`,
  ];
  if (text.length > LINKEDIN_LIMIT) {
    lines.push('', `> [!WARNING]\n> ${text.length} characters: LinkedIn allows ${LINKEDIN_LIMIT} per post.`);
  }
  lines.push(
    '',
    '### Link',
    `${url}`,
    '',
    'Paste it at the end of the post, or in the first comment.',
    '',
    '### Preview card',
    `![link preview](${cardUrl})`,
    '',
    'Check it in [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) if you changed the image after sharing a link before.',
    '',
    'Close this issue once it is posted.',
    '',
    marker(slug),
  );
  return { title: `LinkedIn: ${title}`, body: lines.join('\n') };
}

/** A small GitHub REST client. The token never appears in an error message. */
export function githubClient({ repo, token, fetchImpl = fetch }) {
  async function call(method, path, body) {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sloraris-linkedin-drafts',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }
    return { ok: res.ok, status: res.status, json };
  }
  return { call };
}

/**
 * Opens one issue per post that does not have one yet.
 * @param {{ posts: {slug:string,title:string,description:string,draft:string|null}[], siteUrl: string, repo: string, token: string, fetchImpl?: typeof fetch, log?: (m:string)=>void }} opts
 */
export async function createDrafts({ posts, siteUrl, repo, token, fetchImpl = fetch, log = console.log }) {
  const { call } = githubClient({ repo, token, fetchImpl });

  // One issue per slug, ever: re-running a failed job must not create a second one.
  const existing = new Set();
  for (let page = 1; page <= 10; page++) {
    const res = await call('GET', `/issues?state=all&per_page=100&page=${page}`);
    if (!res.ok) throw new Error(`could not list issues in the content repo (HTTP ${res.status}). Check that Issues are enabled there and the token has "Issues: Read and write".`);
    for (const issue of res.json) {
      for (const [, slug] of String(issue.body ?? '').matchAll(/<!-- linkedin-draft:([^\s]+) -->/g)) existing.add(slug);
    }
    if (res.json.length < 100) break;
  }

  // The label is only a convenience; the issues are fine without it.
  const label = await call('POST', '/labels', { name: LABEL, color: '0a66c2', description: 'Text to post on LinkedIn' });
  const useLabel = label.ok || label.status === 422; // 422: already exists

  const base = siteUrl.replace(/\/+$/, '');
  const created = [];
  for (const post of posts) {
    if (existing.has(post.slug)) {
      log(`${post.slug}: already has a draft issue, skipping`);
      continue;
    }
    const issue = buildIssue({
      slug: post.slug,
      title: post.title,
      url: `${base}/posts/${post.slug}/`,
      cardUrl: `${base}/og/${post.slug}.jpg`,
      draft: post.draft ?? fallbackDraft(post),
      hasOwnDraft: Boolean(post.draft),
    });
    const res = await call('POST', '/issues', { ...issue, ...(useLabel ? { labels: [LABEL] } : {}) });
    if (!res.ok) throw new Error(`${post.slug}: could not create the issue (HTTP ${res.status})`);
    log(`${post.slug}: opened issue #${res.json.number}`);
    created.push({ slug: post.slug, number: res.json.number });
  }
  return created;
}
