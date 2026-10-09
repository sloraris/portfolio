// Astro content loader: your Obsidian vault in, `posts` collection out.
//
// Where the vault lives is decided by the CONTENT_DIR environment variable
// (default ./content), so the same code works locally and in CI.
//
// `pnpm dev:drafts` (SHOW_DRAFTS=1) also renders notes that are NOT published, so their formatting can be
// checked before they go live. That is dev-server only, see draftsWanted() below.

import path from 'node:path';
import { buildPosts } from './posts.mjs';

const truthy = (v) => ['1', 'true', 'yes'].includes(String(v ?? '').trim().toLowerCase());

/**
 * Draft preview needs all three: SHOW_DRAFTS set, a file watcher (Astro only passes one to `astro dev`, never to
 * `astro build`), and no CI. So a stray SHOW_DRAFTS in the build or the deploy workflow cannot publish anything.
 */
export function draftsWanted({ watcher, env = process.env } = {}) {
  return truthy(env.SHOW_DRAFTS) && Boolean(watcher) && !env.CI;
}

export function vaultLoader({ dir = process.env.CONTENT_DIR ?? './content', publicDir = 'public' } = {}) {
  const contentDir = path.resolve(dir);

  return {
    name: 'obsidian-vault',
    async load({ store, parseData, generateDigest, logger, watcher }) {
      const sync = async () => {
        // A missing directory throws, which fails the build on purpose: a
        // misconfigured checkout must never deploy an empty site.
        const { posts } = await buildPosts(contentDir, {
          publicDir: path.resolve(publicDir),
          warn: (m) => logger.warn(m),
          includeDrafts,
        });

        store.clear();
        for (const post of posts) {
          const { id, ...data } = post;
          store.set({ id, data: await parseData({ id, data }), digest: generateDigest(post.html) });
        }

        const drafts = posts.filter((p) => p.draft).length;
        logger.info(
          includeDrafts
            ? `${posts.length - drafts} published + ${drafts} DRAFT note(s) from ${contentDir} (draft preview, dev only)`
            : `${posts.length} published post(s) from ${contentDir}`,
        );
        if (!includeDrafts && posts.length === 0) logger.warn('no notes with `publish: true` were found');
      };

      const includeDrafts = draftsWanted({ watcher });
      if (truthy(process.env.SHOW_DRAFTS) && !includeDrafts) {
        logger.warn('SHOW_DRAFTS is ignored: unpublished notes are only shown by `pnpm dev:drafts` on your machine');
      }

      await sync();

      // `astro dev`: re-sync when a note changes in the vault.
      if (watcher) {
        watcher.add(contentDir);
        let timer;
        const onChange = (changed) => {
          if (!path.resolve(changed).startsWith(contentDir + path.sep)) return;
          clearTimeout(timer);
          timer = setTimeout(() => sync().catch((err) => logger.error(String(err))), 150);
        };
        for (const evt of ['add', 'change', 'unlink']) watcher.on(evt, onChange);
      }
    },
  };
}
