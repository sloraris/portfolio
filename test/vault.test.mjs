import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPosts } from '../src/lib/vault/posts.mjs';
import { scanVault } from '../src/lib/vault/scan.mjs';
import { stripComments } from '../src/lib/vault/comments.mjs';
import { parseYoutube } from '../src/lib/vault/plugins.mjs';
import { vaultLoader, draftsWanted } from '../src/lib/vault/loader.mjs';

// GitHub Actions sets CI=true, which makes the loader redact note names from its warnings (the logs are
// public). Most tests assert on the full warning text, so run them as on a laptop; the tests that cover
// the CI behaviour set CI themselves and put it back afterwards.
delete process.env.CI;

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/vault');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
}
function write(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
async function build(root, extra = {}) {
  const warnings = [];
  const publicDir = tmp();
  const result = await buildPosts(root, { publicDir, warn: (m) => warnings.push(m), ...extra });
  return { ...result, warnings, publicDir };
}

// ------------------------------------------------------------------ publish gate

test('only notes with publish: true become posts', async () => {
  const { posts } = await build(FIXTURES);
  assert.deepEqual(posts.map((p) => p.slug).sort(), [
    'about',
    'defense-in-depth',
    'example-archived-project',
    'example-featured-project',
    'example-finished-project',
    'spiral-stairs',
  ]);
});

test('unpublished content and attachments never reach the output', async () => {
  const { posts, publicDir } = await build(FIXTURES);
  const everything = JSON.stringify(posts);
  assert.ok(!everything.includes('SECRET-CONTENT'));
  assert.ok(!everything.includes('This is a draft'));
  const copied = fs.readdirSync(path.join(publicDir, 'media'), { recursive: true }).join('\n');
  assert.ok(!copied.includes('secret-image'));
});

test('`publish: "yes"` and `published: true` also count; false/missing do not', () => {
  const root = tmp();
  write(root, 'a.md', '---\npublish: yes\n---\nA');
  write(root, 'b.md', '---\npublished: true\n---\nB');
  write(root, 'c.md', '---\npublish: false\n---\nC');
  write(root, 'd.md', 'no frontmatter');
  const names = scanVault(root).published.map((n) => n.name).sort();
  assert.deepEqual(names, ['a', 'b']);
});

test('dot-folders (.obsidian, .git, .trash) are never scanned', () => {
  const root = tmp();
  write(root, 'ok.md', '---\npublish: true\n---\nok');
  write(root, '.trash/gone.md', '---\npublish: true\n---\ngone');
  write(root, '.obsidian/x.md', '---\npublish: true\n---\nx');
  assert.deepEqual(scanVault(root).published.map((n) => n.name), ['ok']);
});

test('a missing content directory is an error, not an empty site', () => {
  assert.throws(() => scanVault(path.join(os.tmpdir(), 'definitely-not-here-123')), /content directory not found/);
});

test('two published notes with the same slug fail the build', () => {
  const root = tmp();
  write(root, 'one/Same Name.md', '---\npublish: true\n---\n1');
  write(root, 'two/Same Name.md', '---\npublish: true\n---\n2');
  assert.throws(() => scanVault(root), /duplicate slug "same-name"/);
});

test('broken frontmatter skips the note instead of failing the build', () => {
  const root = tmp();
  write(root, 'bad.md', '---\ntitle: [unclosed\n---\nbody');
  write(root, 'good.md', '---\npublish: true\n---\nbody');
  const warnings = [];
  const vault = scanVault(root, { warn: (m) => warnings.push(m) });
  assert.deepEqual(vault.published.map((n) => n.name), ['good']);
  assert.equal(warnings.length, 1);
});

// ------------------------------------------------------------------ comments

test('stripComments removes inline and multi-line %% comments', () => {
  assert.equal(stripComments('a %% hidden %% b'), 'a  b');
  assert.equal(stripComments('top\n%%\nprivate\nnotes\n%%\nbottom'), 'top\nbottom');
});

test('stripComments leaves code fences and inline code alone', () => {
  const src = '```js\n// %% keep %%\n```\n\nuse `%%` literally';
  assert.equal(stripComments(src), src);
});

test('an unterminated comment swallows the rest of the file (like Obsidian)', () => {
  assert.equal(stripComments('visible\n%% never closed\nsecret'), 'visible');
});

test('the outline in the fixture post is not in the rendered HTML', async () => {
  const { posts } = await build(FIXTURES);
  const post = posts.find((p) => p.slug === 'defense-in-depth');
  assert.ok(!post.html.includes('castle metaphor'));
  assert.ok(!post.html.includes('hook:'));
  assert.ok(!post.html.includes('private aside'));
});

// ------------------------------------------------------------------ links

test('wikilinks to published notes become links; aliases and headings work', async () => {
  const { posts } = await build(FIXTURES);
  const { html } = posts.find((p) => p.slug === 'defense-in-depth');
  assert.match(html, /<a href="\/posts\/spiral-stairs\/">Spiral Stairs<\/a>/);
  assert.match(html, /<a href="\/posts\/spiral-stairs\/">the stairs<\/a>/);
  assert.match(html, /<a href="\/posts\/defense-in-depth\/#takeaways">/);
});

test('wikilinks to unpublished notes degrade to plain text and warn', async () => {
  const { posts, warnings } = await build(FIXTURES);
  const { html } = posts.find((p) => p.slug === 'defense-in-depth');
  assert.ok(html.includes('Not Published Yet'));
  assert.ok(!html.includes('/posts/not-published-yet'));
  assert.ok(warnings.some((w) => w.includes('unpublished')));
});

test('markdown links to .md files are resolved the same way', async () => {
  const { posts } = await build(FIXTURES);
  const { html } = posts.find((p) => p.slug === 'defense-in-depth');
  assert.match(html, /<a href="\/posts\/spiral-stairs\/">notes on stairs<\/a>/);
  assert.ok(!html.includes('Secret%20Draft'));
});

test('wikilink syntax inside code is left untouched', async () => {
  const { posts } = await build(FIXTURES);
  const { html } = posts.find((p) => p.slug === 'defense-in-depth');
  assert.ok(html.includes('[[code stays]]'));
  assert.ok(html.includes('[[not a link]]'));
});

// ------------------------------------------------------------------ media

test('![[embeds]] and relative images resolve from the note\'s _attachments folder', async () => {
  const { posts, publicDir } = await build(FIXTURES);
  const { html } = posts.find((p) => p.slug === 'defense-in-depth');
  assert.match(html, /src="\/media\/defense-in-depth\/pasted-image-20251001\.png"[^>]*width="300"/);
  assert.match(html, /src="\/media\/defense-in-depth\/diagram\.png" alt="A diagram"/);
  assert.ok(fs.existsSync(path.join(publicDir, 'media/defense-in-depth/diagram.png')));
});

test('cover property is resolved to a copied asset', async () => {
  const { posts } = await build(FIXTURES);
  assert.equal(posts.find((p) => p.slug === 'defense-in-depth').cover, '/media/defense-in-depth/diagram.png');
});

test('an attachment outside the vault is never copied (path traversal)', async () => {
  const outer = tmp();
  fs.writeFileSync(path.join(outer, 'outside.txt'), 'TOP-SECRET');
  const root = path.join(outer, 'vault');
  write(root, 'post.md', '---\npublish: true\n---\n![[../outside.txt]]\n\n![x](../outside.png)\n\n[leak](../outside.txt)');
  fs.writeFileSync(path.join(outer, 'outside.png'), 'x');
  const { publicDir, posts } = await build(root);
  assert.ok(!fs.existsSync(path.join(publicDir, 'media')), 'nothing should have been copied');
  assert.ok(!posts[0].html.includes('/media/'));
});

test('missing attachments warn but do not fail the build', async () => {
  const root = tmp();
  write(root, 'post.md', '---\npublish: true\n---\n![[nope.png]]');
  const { warnings, posts } = await build(root);
  assert.equal(posts.length, 1);
  assert.ok(warnings.some((w) => w.includes('attachment not found')));
});

// ------------------------------------------------------------------ youtube

test('parseYoutube handles the common URL shapes and timestamps', () => {
  assert.deepEqual(parseYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { id: 'dQw4w9WgXcQ', start: 0 });
  assert.deepEqual(parseYoutube('https://youtu.be/dQw4w9WgXcQ?t=90'), { id: 'dQw4w9WgXcQ', start: 90 });
  assert.deepEqual(parseYoutube('https://youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'), { id: 'dQw4w9WgXcQ', start: 90 });
  assert.deepEqual(parseYoutube('https://www.youtube.com/shorts/abcDEF12345'), { id: 'abcDEF12345', start: 0 });
  assert.equal(parseYoutube('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseYoutube('not a url'), null);
});

test('a bare ![](youtube-url) becomes a privacy-friendly embed', async () => {
  const { posts } = await build(FIXTURES);
  const { html } = posts.find((p) => p.slug === 'defense-in-depth');
  assert.match(html, /<div class="video-embed"><iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?start=90"/);
});

// ------------------------------------------------------------------ callouts, highlight, code

test('callouts: types, titles, folding and defaults', async () => {
  const { posts } = await build(FIXTURES);
  const { html } = posts.find((p) => p.slug === 'defense-in-depth');
  assert.match(html, /<div class="callout" data-callout="tip">\s*<div class="callout-title">Remember<\/div>/);
  assert.match(html, /<details class="callout" data-callout="warning">\s*<summary class="callout-title">Folded by default/);
  assert.match(html, /<details class="callout" data-callout="note" open>\s*<summary class="callout-title">Note</);
});

test('==highlights== become <mark>', async () => {
  const { posts } = await build(FIXTURES);
  assert.ok(posts.find((p) => p.slug === 'defense-in-depth').html.includes('<mark>highlighted text</mark>'));
});

test('unknown code languages do not crash the build', async () => {
  const root = tmp();
  write(root, 'p.md', '---\npublish: true\n---\n```dataview\nTABLE x\n```');
  const { posts } = await build(root);
  assert.match(posts[0].html, /<pre/);
});

// ------------------------------------------------------------------ metadata

test('title: frontmatter wins; a matching leading H1 is dropped, a different one is kept', async () => {
  const root = tmp();
  write(root, 'a.md', '---\npublish: true\ntitle: Same\n---\n# Same\n\nbody');
  write(root, 'b.md', '---\npublish: true\ntitle: Front\n---\n# Different\n\nbody');
  write(root, 'c.md', '---\npublish: true\n---\n# From Heading\n\nbody');
  write(root, 'File Name.md', '---\npublish: true\n---\nbody only');
  const { posts } = await build(root);
  const by = Object.fromEntries(posts.map((p) => [p.source, p]));
  assert.ok(!by['a.md'].html.includes('<h1'));
  assert.ok(by['b.md'].html.includes('<h1'));
  assert.equal(by['c.md'].title, 'From Heading');
  assert.ok(!by['c.md'].html.includes('<h1'));
  assert.equal(by['File Name.md'].title, 'File Name');
});

test('description falls back to the first paragraph; tags are normalised', async () => {
  const root = tmp();
  write(root, 'p.md', '---\npublish: true\ntags: ["#Homelab", security, homelab]\n---\nFirst paragraph here.\n\nSecond.');
  const { posts } = await build(root);
  assert.equal(posts[0].description, 'First paragraph here.');
  assert.deepEqual(posts[0].tags, ['homelab', 'security']);
});

test('date: frontmatter date is used; missing date warns and falls back', async () => {
  const root = tmp();
  write(root, 'dated.md', '---\npublish: true\ndate: 2024-03-09\n---\nx');
  write(root, 'undated.md', '---\npublish: true\n---\nx');
  const { posts, warnings } = await build(root);
  assert.equal(posts.find((p) => p.source === 'dated.md').date.toISOString().slice(0, 10), '2024-03-09');
  assert.ok(warnings.some((w) => w.includes('undated.md') && w.includes('no date')));
});

test('reading time and headings are computed', async () => {
  const root = tmp();
  const words = Array.from({ length: 800 }, () => 'word').join(' ');
  write(root, 'p.md', `---\npublish: true\n---\n## One\n\n${words}\n\n### Two\n\n#### Three`);
  const { posts } = await build(root);
  assert.equal(posts[0].readingTime, 4);
  assert.deepEqual(posts[0].headings.map((h) => [h.depth, h.id]), [[2, 'one'], [3, 'two'], [4, 'three']]);
});

test('in CI, warnings do not name unpublished notes', async () => {
  const prev = process.env.CI;
  process.env.CI = 'true';
  try {
    const { warnings } = await build(FIXTURES);
    const all = warnings.join('\n');
    assert.ok(!all.includes('Not Published Yet'));
    assert.ok(!all.includes('Secret'));
  } finally {
    if (prev === undefined) delete process.env.CI;
    else process.env.CI = prev;
  }
});

// ------------------------------------------------------------------ pages (type: page)

test('`type: page` and `type: project` notes are marked as such, everything else as posts', async () => {
  const { posts } = await build(FIXTURES);
  const by = Object.fromEntries(posts.map((p) => [p.slug, p.type]));
  assert.deepEqual(by, {
    about: 'page',
    'defense-in-depth': 'post',
    'example-archived-project': 'project',
    'example-featured-project': 'project',
    'example-finished-project': 'project',
    'spiral-stairs': 'post',
  });
});

test('wikilinks to a page point at /<slug>/, not /posts/<slug>/', async () => {
  const root = tmp();
  write(root, 'About me.md', '---\npublish: true\ntype: page\nslug: about\n---\nhi');
  write(root, 'post.md', '---\npublish: true\n---\nSee [[About me]] and [the page](About%20me.md).');
  const { posts } = await build(root);
  const html = posts.find((p) => p.slug === 'post').html;
  assert.equal((html.match(/href="\/about\/"/g) ?? []).length, 2);
  assert.ok(!html.includes('/posts/about/'));
});

test('a page slug cannot shadow a site route', () => {
  for (const slug of ['posts', 'projects', 'media', '404']) {
    const root = tmp();
    write(root, 'x.md', `---\npublish: true\ntype: page\nslug: ${slug}\n---\nx`);
    assert.throws(() => scanVault(root), /reserved by the site/, slug);
  }
});

test('an unpublished page is not checked and is not built', async () => {
  const root = tmp();
  write(root, 'x.md', '---\ntype: page\nslug: posts\n---\nx');
  const { posts } = await build(root);
  assert.equal(posts.length, 0);
});

// ------------------------------------------------------------------ projects (type: project)

const project = (extra = '', body = '# Thing\n\nPitch.') =>
  `---\npublish: true\ntype: project\ndate: 2026-01-01\n${extra}---\n${body}`;

test('`type: project` notes are projects, with defaults for every optional property', async () => {
  const root = tmp();
  write(root, 'Thing.md', project());
  const { posts, warnings } = await build(root);
  const p = posts[0];
  assert.equal(p.type, 'project');
  assert.deepEqual([p.status, p.featured, p.weight, p.stack], ['active', false, 100, []]);
  assert.deepEqual([p.repo, p.demo, p.writeup], [undefined, undefined, undefined]);
  assert.equal(p.description, 'Pitch.');
  assert.deepEqual(warnings, []);
});

test('project properties are normalised: status case, featured yes, weight, stack case and duplicates', async () => {
  const root = tmp();
  write(root, 'Thing.md', project('status: Finished\nfeatured: yes\nweight: "5"\nstack: [TypeScript, typescript, Docker, " "]\n'));
  write(root, 'Other.md', project('stack: "Go, Rust, go"\nfeatured: false\n'));
  const { posts } = await build(root);
  const thing = posts.find((p) => p.slug === 'thing');
  assert.deepEqual([thing.status, thing.featured, thing.weight], ['finished', true, 5]);
  assert.deepEqual(thing.stack, ['TypeScript', 'Docker']);
  const other = posts.find((p) => p.slug === 'other');
  assert.deepEqual(other.stack, ['Go', 'Rust']);
  assert.equal(other.featured, false);
});

test('an invalid status or weight warns and falls back to the default', async () => {
  const root = tmp();
  write(root, 'Thing.md', project('status: someday\nweight: heavy\n'));
  const { posts, warnings } = await build(root);
  assert.deepEqual([posts[0].status, posts[0].weight], ['active', 100]);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some((w) => w.includes('status')));
  assert.ok(warnings.some((w) => w.includes('weight')));
});

test('repo and demo accept only http(s) URLs', async () => {
  const root = tmp();
  write(root, 'Good.md', project('repo: https://github.com/a/b\ndemo: http://example.com/x\n'));
  write(root, 'Bad.md', project('repo: "javascript:alert(1)"\ndemo: /relative\n'));
  const { posts, warnings } = await build(root);
  const good = posts.find((p) => p.slug === 'good');
  assert.deepEqual([good.repo, good.demo], ['https://github.com/a/b', 'http://example.com/x']);
  const bad = posts.find((p) => p.slug === 'bad');
  assert.deepEqual([bad.repo, bad.demo], [undefined, undefined]);
  assert.equal(warnings.filter((w) => w.includes('must be an http(s) URL')).length, 2);
});

test('wikilinks and .md links to a project point at /projects/<slug>/, not /posts/<slug>/', async () => {
  const root = tmp();
  write(root, 'Big Thing.md', project());
  write(root, 'post.md', '---\npublish: true\n---\nSee [[Big Thing]], [[Big Thing|this]] and [md](Big%20Thing.md).');
  const { posts } = await build(root);
  const html = posts.find((p) => p.slug === 'post').html;
  assert.equal((html.match(/href="\/projects\/big-thing\/"/g) ?? []).length, 3);
  assert.ok(!html.includes('/posts/big-thing/'));
});

test('writeup resolves a published note (wikilink or plain name) and keeps an http URL', async () => {
  const root = tmp();
  write(root, 'Story.md', '---\npublish: true\ndate: 2026-01-01\n---\nhi');
  write(root, 'A.md', project('writeup: "[[Story]]"\n'));
  write(root, 'B.md', project('writeup: "[[Story|the story#Intro]]"\n'));
  write(root, 'C.md', project('writeup: Story\n'));
  write(root, 'D.md', project('writeup: https://example.com/post\n'));
  const { posts, warnings } = await build(root);
  const w = Object.fromEntries(posts.filter((p) => p.type === 'project').map((p) => [p.slug, p.writeup]));
  assert.deepEqual(w, { a: '/posts/story/', b: '/posts/story/', c: '/posts/story/', d: 'https://example.com/post' });
  assert.deepEqual(warnings, []);
});

test('writeup pointing at an unpublished or missing note is dropped with a warning', async () => {
  const root = tmp();
  write(root, 'Draft.md', '---\ndate: 2026-01-01\n---\nnot published');
  write(root, 'A.md', project('writeup: "[[Draft]]"\n'));
  write(root, 'B.md', project('writeup: "[[Nope]]"\n'));
  write(root, 'C.md', project('writeup: "[[C]]"\n')); // a project cannot be its own write-up
  const { posts, warnings } = await build(root);
  assert.ok(posts.filter((p) => p.type === 'project').every((p) => p.writeup === undefined));
  assert.equal(warnings.length, 3);
  assert.ok(warnings[0].includes('an unpublished note'));
  assert.ok(warnings[1].includes('does not exist'));
});

test('in CI, the writeup warning does not name the unpublished note', async () => {
  const prev = process.env.CI;
  process.env.CI = 'true';
  try {
    const root = tmp();
    write(root, 'Secret Plans.md', '---\ndate: 2026-01-01\n---\nnot published');
    write(root, 'A.md', project('writeup: "[[Secret Plans]]"\n'));
    const { warnings } = await build(root);
    assert.equal(warnings.length, 1);
    assert.ok(!warnings[0].includes('Secret Plans'));
  } finally {
    if (prev === undefined) delete process.env.CI;
    else process.env.CI = prev;
  }
});

test('a project and a post cannot share a slug', () => {
  const root = tmp();
  write(root, 'a/Thing.md', project());
  write(root, 'b/Thing.md', '---\npublish: true\n---\npost');
  assert.throws(() => scanVault(root), /duplicate slug "thing"/);
});

test('an unpublished project is not built', async () => {
  const root = tmp();
  write(root, 'Thing.md', '---\ntype: project\n---\nwip');
  const { posts } = await build(root);
  assert.equal(posts.length, 0);
});


// ------------------------------------------------------------------ draft preview (pnpm dev:drafts)

test('draft preview renders unpublished notes, flagged as drafts, and leaves real posts alone', async () => {
  const { posts } = await build(FIXTURES, { includeDrafts: true });
  const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
  assert.equal(bySlug['not-published-yet'].draft, true);
  assert.equal(bySlug['secret-draft'].draft, true);
  assert.equal(bySlug['defense-in-depth'].draft, undefined);
  assert.equal(bySlug['example-featured-project'].draft, undefined);
});

test('without includeDrafts nothing is a draft (the default and every real build)', async () => {
  const { posts } = await build(FIXTURES);
  assert.ok(posts.every((p) => p.draft === undefined));
  assert.ok(!posts.some((p) => p.slug === 'not-published-yet'));
});

test('drafts keep their type: an unpublished project and page land in their own sections', async () => {
  const root = tmp();
  write(root, 'Proj.md', '---\ntype: project\nstack: [Go]\n---\n# Proj\nwip');
  write(root, 'Pg.md', '---\ntype: page\nslug: hello\n---\n# Pg\nwip');
  write(root, 'Post.md', '---\npublish: false\n---\n# Post\nwip');
  const { posts, warnings } = await build(root, { includeDrafts: true });
  assert.deepEqual(
    posts.map((p) => [p.slug, p.type, p.draft]).sort(),
    [['hello', 'page', true], ['post', 'post', true], ['proj', 'project', true]],
  );
  assert.deepEqual(warnings, [], 'an undated draft does not nag about its date');
});

test('wikilinks between drafts, and from a draft to a published note, resolve', async () => {
  const root = tmp();
  write(root, 'A.md', '---\npublish: true\n---\nSee [[B]] and [[C]].');
  write(root, 'B.md', '---\ntype: project\n---\nback to [[A]]');
  write(root, 'C.md', '---\npublish: false\n---\nhi');
  const live = await build(root);
  assert.ok(!live.posts[0].html.includes('href'), 'on the live build links to unpublished notes stay plain text');
  const { posts } = await build(root, { includeDrafts: true });
  const html = Object.fromEntries(posts.map((p) => [p.slug, p.html]));
  assert.ok(html.a.includes('href="/projects/b/"'));
  assert.ok(html.a.includes('href="/posts/c/"'));
  assert.ok(html.b.includes('href="/posts/a/"'));
});

test('a draft can never take the URL of a published note, or a reserved page slug; both only warn', async () => {
  const root = tmp();
  write(root, 'Live/Thing.md', '---\npublish: true\n---\nlive');
  write(root, 'Old/Thing.md', '---\npublish: false\n---\nSTALE-COPY');
  write(root, 'Projects.md', '---\ntype: page\n---\nreserved');
  const { posts, warnings } = await build(root, { includeDrafts: true });
  assert.deepEqual(posts.map((p) => [p.slug, p.draft]), [['thing', undefined]]);
  assert.ok(!JSON.stringify(posts).includes('STALE-COPY'));
  assert.equal(warnings.filter((w) => w.includes('draft preview')).length, 2);
  // two real published notes still fail loudly
  write(root, 'Other/Thing.md', '---\npublish: true\n---\nclash');
  assert.throws(() => scanVault(root, { includeDrafts: true }), /duplicate slug "thing"/);
});

test('drafts only ever load under the dev server: no SHOW_DRAFTS, no watcher, or CI all mean off', () => {
  const watcher = { add() {}, on() {} };
  assert.equal(draftsWanted({ watcher, env: { SHOW_DRAFTS: '1' } }), true);
  assert.equal(draftsWanted({ watcher, env: { SHOW_DRAFTS: 'true' } }), true);
  assert.equal(draftsWanted({ watcher, env: {} }), false);
  assert.equal(draftsWanted({ watcher, env: { SHOW_DRAFTS: '0' } }), false);
  assert.equal(draftsWanted({ env: { SHOW_DRAFTS: '1' } }), false, 'astro build passes no watcher');
  assert.equal(draftsWanted({ watcher, env: { SHOW_DRAFTS: '1', CI: 'true' } }), false);
});

test('the real loader keeps drafts out of the store when SHOW_DRAFTS is set but there is no watcher (a build)', async () => {
  const root = tmp();
  write(root, 'Live.md', '---\npublish: true\n---\n# Live\nok');
  write(root, 'Draft.md', '---\npublish: false\n---\n# Draft\nSECRET-DRAFT');
  const run = async (watcher) => {
    const stored = [];
    const logs = [];
    await vaultLoader({ dir: root, publicDir: tmp() }).load({
      store: { clear() { stored.length = 0; }, set: (e) => stored.push(e) },
      parseData: async ({ data }) => data,
      generateDigest: () => 'x',
      logger: { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) },
      watcher,
    });
    return { slugs: stored.map((e) => e.id).sort(), logs };
  };
  const prev = { SHOW_DRAFTS: process.env.SHOW_DRAFTS, CI: process.env.CI };
  try {
    process.env.SHOW_DRAFTS = '1';
    delete process.env.CI;
    const build = await run(undefined);
    assert.deepEqual(build.slugs, ['live']);
    assert.ok(build.logs.some((l) => l.includes('SHOW_DRAFTS is ignored')));
    const dev = await run({ add() {}, on() {} });
    assert.deepEqual(dev.slugs, ['draft', 'live']);
  } finally {
    for (const [k, v] of Object.entries(prev)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
});
