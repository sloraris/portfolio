#!/usr/bin/env node
// Run by .github/workflows/deploy.yml. Two steps, in two different jobs:
//
//   detect  (build job, after `astro build`, before the deploy)
//           Compares the posts in dist/ with the ones the live site has, and writes the new ones (slug, title,
//           description: all public) to the job output `new_posts`. It never fails the build: if anything is
//           off it reports no new posts, so there is no draft but the deploy is unaffected.
//
//   create  (linkedin-drafts job, after a successful deploy)
//           Reads each new post's `%% linkedin %%` block from the private content repo and opens one issue per
//           post in that repo. This is the only step that has the issues token. It does not print any draft text,
//           because the logs of this (public) repo are public.
//
// Environment:  SITE_URL (default https://sloraris.dev), SITE_TITLE (default sloraris)
//   detect:  LIVE_SITEMAP_FILE (tests only: read the "live" sitemap from a file), GITHUB_OUTPUT
//   create:  NEW_POSTS, CONTENT_DIR (default content), ISSUE_REPO (owner/name), GH_TOKEN

import fs from 'node:fs';
import path from 'node:path';
import { scanVault } from '../src/lib/vault/scan.mjs';
import { createDrafts, extractLinkedinDraft, newSlugs, parsePostSlugs, readPostMeta } from '../src/lib/linkedin.mjs';

const SITE_URL = (process.env.SITE_URL || 'https://sloraris.dev').replace(/\/+$/, '');
const SITE_TITLE = process.env.SITE_TITLE || 'sloraris';

function setOutput(name, value) {
  const line = `${name}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
  else process.stdout.write(`[output] ${line}`);
}

async function detect() {
  const none = (why) => {
    console.log(`::notice title=No LinkedIn drafts::${why}`);
    setOutput('new_posts', '[]');
  };

  let liveXml;
  try {
    if (process.env.LIVE_SITEMAP_FILE) {
      liveXml = fs.readFileSync(process.env.LIVE_SITEMAP_FILE, 'utf8');
    } else {
      const res = await fetch(`${SITE_URL}/sitemap-0.xml?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) return none(`The live site has no sitemap yet (HTTP ${res.status}); this looks like the first deploy, so nothing is drafted.`);
      liveXml = await res.text();
    }
  } catch (err) {
    return none(`Could not reach the live site (${err.message}), so nothing is drafted. Re-run the workflow if you expected a draft.`);
  }

  const live = parsePostSlugs(liveXml);
  if (!live) return none('The live sitemap is not a sitemap, so nothing is drafted.');
  const built = parsePostSlugs(fs.readFileSync('dist/sitemap-0.xml', 'utf8'));
  const fresh = newSlugs(live, built);

  const posts = fresh.map((slug) => {
    const html = fs.readFileSync(path.join('dist', 'posts', slug, 'index.html'), 'utf8');
    const { title, description } = readPostMeta(html, SITE_TITLE);
    return { slug, title: title || slug, description };
  });
  console.log(`${posts.length} new post(s): ${posts.map((p) => p.slug).join(', ') || '-'}`);
  setOutput('new_posts', JSON.stringify(posts));
}

async function create() {
  const posts = JSON.parse(process.env.NEW_POSTS || '[]');
  if (!posts.length) return console.log('No new posts.');
  const { ISSUE_REPO: repo, GH_TOKEN: token } = process.env;
  if (!repo || !token) throw new Error('ISSUE_REPO and GH_TOKEN must be set');

  // A no-op `warn`: the vault scanner names notes in its warnings, and these logs are public.
  const vault = scanVault(process.env.CONTENT_DIR || 'content', { warn: () => {} });
  const withDrafts = posts.map((post) => {
    const note = vault.published.find((n) => n.slug === post.slug && n.data?.type !== 'page' && n.data?.type !== 'project');
    return { ...post, draft: note ? extractLinkedinDraft(note.body) : null };
  });

  const created = await createDrafts({ posts: withDrafts, siteUrl: SITE_URL, repo, token });
  console.log(`Opened ${created.length} issue(s).`);
}

const commands = { detect, create };
const run = commands[process.argv[2]];
if (!run) {
  console.error('usage: linkedin-drafts.mjs detect|create');
  process.exit(2);
}
try {
  await run();
} catch (err) {
  if (process.argv[2] === 'detect') {
    // Never block a deploy over drafts.
    console.log(`::warning title=LinkedIn drafts::${err.message}`);
    setOutput('new_posts', '[]');
  } else {
    console.error(`::error title=LinkedIn drafts::${err.message}`);
    process.exit(1);
  }
}
