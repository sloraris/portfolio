import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from '../src/lib/vault/comments.mjs';
import {
  buildIssue,
  createDrafts,
  extractLinkedinDraft,
  fallbackDraft,
  findComments,
  newSlugs,
  parsePostSlugs,
  readPostMeta,
} from '../src/lib/linkedin.mjs';

test('the linkedin block is found, multi-line or inline', () => {
  assert.equal(extractLinkedinDraft('Intro\n\n%% linkedin\nHook line.\n\nSecond part.\n%%\n\nBody'), 'Hook line.\n\nSecond part.');
  assert.equal(extractLinkedinDraft('%% linkedin: short one %%'), 'short one');
  assert.equal(extractLinkedinDraft('%%LinkedIn\r\nWindows endings\r\n%%'), 'Windows endings');
});

test('other comments, empty blocks and words that merely start with linkedin are not drafts', () => {
  assert.equal(extractLinkedinDraft('%% outline\n- hook\n%%'), null);
  assert.equal(extractLinkedinDraft('%% linkedin %%'), null);
  assert.equal(extractLinkedinDraft('%% linkedin\n\n%%'), null);
  assert.equal(extractLinkedinDraft('%% linkedin-notes: later %%'), null);
  assert.equal(extractLinkedinDraft('no comments at all'), null);
  assert.equal(extractLinkedinDraft(undefined), null);
});

test('comments inside code are not drafts, same as stripComments', () => {
  const body = ['```', '%% linkedin', 'not a draft', '%%', '```', '', 'and `%% linkedin inline code %%` too'].join('\n');
  assert.deepEqual(findComments(body), []);
  assert.equal(extractLinkedinDraft(body), null);
  assert.equal(stripComments(body), body); // the page keeps them, so they are not comments
});

test('the first linkedin comment wins and the page never shows it', () => {
  const body = '%% outline %%\nText\n%% linkedin\nFirst\n%%\n%% linkedin\nSecond\n%%';
  assert.equal(extractLinkedinDraft(body), 'First');
  assert.equal(stripComments(body).trim(), 'Text');
});

const sitemap = (...paths) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>https://sloraris.dev${p}</loc></url>`).join('')}</urlset>`;

test('only /posts/<slug>/ pages count as posts', () => {
  const slugs = parsePostSlugs(sitemap('/', '/about/', '/posts/', '/posts/one/', '/posts/tag/homelab/', '/projects/p/', '/posts/two/'));
  assert.deepEqual([...slugs].sort(), ['one', 'two']);
});

test('something that is not a sitemap gives no baseline, and no baseline means no drafts', () => {
  assert.equal(parsePostSlugs('<html>404</html>'), null);
  assert.deepEqual(newSlugs(null, new Set(['a'])), []);
});

test('new posts are the built ones that are not live yet; an empty live site counts', () => {
  assert.deepEqual(newSlugs(new Set(['a']), new Set(['a', 'c', 'b'])), ['b', 'c']);
  assert.deepEqual(newSlugs(new Set(), new Set(['first'])), ['first']);
  assert.deepEqual(newSlugs(new Set(['a', 'b']), new Set(['a'])), []); // unpublished posts are not drafts
});

test('title and description come out of the minified page, quoted or not', () => {
  const quoted = '<meta property="og:title" content="Defense &amp; Depth · sloraris"><meta name="description" content="It&#39;s layers.">';
  assert.deepEqual(readPostMeta(quoted, 'sloraris'), { title: 'Defense & Depth', description: "It's layers." });
  const bare = '<meta property=og:title content=Short><meta property=og:description content=Tiny>';
  assert.deepEqual(readPostMeta(bare, 'sloraris'), { title: 'Short', description: 'Tiny' });
});

test('the issue holds the text in a code block that survives backticks, and the marker', () => {
  const { title, body } = buildIssue({
    slug: 'a-post',
    title: 'A post',
    url: 'https://sloraris.dev/posts/a-post/',
    cardUrl: 'https://sloraris.dev/og/a-post.jpg',
    draft: 'Use ```code``` here',
    hasOwnDraft: true,
  });
  assert.equal(title, 'LinkedIn: A post');
  assert.match(body, /````text\nUse ```code``` here\n````/);
  assert.match(body, /<!-- linkedin-draft:a-post -->/);
  assert.match(body, /!\[link preview\]\(https:\/\/sloraris\.dev\/og\/a-post\.jpg\)/);
  assert.doesNotMatch(body, /Rewrite it before posting/);
  assert.match(body, /\[LinkedIn Preview\]\(https:\/\/linkedinpreview\.com\/dashboard\)/);
});

test('without a block the issue says so, and a too-long draft is flagged', () => {
  const plain = buildIssue({ slug: 's', title: 'T', url: 'u', cardUrl: 'c', draft: fallbackDraft({ title: 'T', description: 'D' }), hasOwnDraft: false });
  assert.match(plain.body, /Rewrite it before posting/);
  assert.match(plain.body, /text\nT\n\nD\n/);
  const long = buildIssue({ slug: 's', title: 'T', url: 'u', cardUrl: 'c', draft: 'x'.repeat(3001), hasOwnDraft: true });
  assert.match(long.body, /3001 characters/);
});

// A tiny fake of the GitHub API: records requests, returns canned issues.
function fakeGithub({ issues = [], labelStatus = 201, failCreate = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    calls.push({ method, path: u.pathname + u.search, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.Authorization });
    const reply = (status, json) => ({ ok: status < 300, status, text: async () => JSON.stringify(json) });
    if (method === 'GET' && u.pathname.endsWith('/issues')) return reply(200, u.searchParams.get('page') === '1' ? issues : []);
    if (method === 'POST' && u.pathname.endsWith('/labels')) return reply(labelStatus, {});
    if (method === 'POST' && u.pathname.endsWith('/issues')) return failCreate ? reply(403, {}) : reply(201, { number: 40 + calls.length });
    return reply(404, {});
  };
  return { calls, fetchImpl };
}
const posts = [
  { slug: 'one', title: 'One', description: 'First.', draft: 'Hand-written' },
  { slug: 'two', title: 'Two', description: 'Second.', draft: null },
];
const opts = { siteUrl: 'https://sloraris.dev/', repo: 'me/content', token: 'SECRET', log: () => {} };

test('one issue per new post, labelled, using the draft or the fallback', async () => {
  const gh = fakeGithub();
  const created = await createDrafts({ ...opts, posts, fetchImpl: gh.fetchImpl });
  assert.equal(created.length, 2);
  const issues = gh.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/issues'));
  assert.equal(issues.length, 2);
  assert.deepEqual(issues[0].body.labels, ['linkedin-draft']);
  assert.match(issues[0].body.body, /Hand-written/);
  assert.match(issues[1].body.body, /Rewrite it before posting/);
  assert.match(issues[1].body.body, /https:\/\/sloraris\.dev\/posts\/two\//); // no double slash from the trailing / in siteUrl
  assert.ok(gh.calls.every((c) => c.auth === 'Bearer SECRET'));
});

test('a post that already has an issue (open or closed) is skipped, so a re-run adds no duplicates', async () => {
  const gh = fakeGithub({ issues: [{ body: 'x\n<!-- linkedin-draft:one -->' }] });
  const created = await createDrafts({ ...opts, posts, fetchImpl: gh.fetchImpl });
  assert.deepEqual(created.map((c) => c.slug), ['two']);
});

test('issues are still created if the label cannot be', async () => {
  const gh = fakeGithub({ labelStatus: 403 });
  await createDrafts({ ...opts, posts: [posts[0]], fetchImpl: gh.fetchImpl });
  const issue = gh.calls.find((c) => c.method === 'POST' && c.path.endsWith('/issues'));
  assert.equal(issue.body.labels, undefined);
});

test('a refused request fails the job with a message, never with the token', async () => {
  const gh = fakeGithub({ failCreate: true });
  await assert.rejects(createDrafts({ ...opts, posts: [posts[0]], fetchImpl: gh.fetchImpl }), (err) => /HTTP 403/.test(err.message) && !err.message.includes('SECRET'));
});
