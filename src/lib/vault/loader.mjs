// Astro content loader: your Obsidian vault in, `posts` collection out.
//
// Where the vault lives is decided by the CONTENT_DIR environment variable
// (default ./content), so the same code works locally and in CI.

import path from 'node:path';
import { buildPosts } from './posts.mjs';

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
        });

        store.clear();
        for (const post of posts) {
          const { id, ...data } = post;
          store.set({ id, data: await parseData({ id, data }), digest: generateDigest(post.html) });
        }

        logger.info(`${posts.length} published post(s) from ${contentDir}`);
        if (posts.length === 0) logger.warn('no notes with `publish: true` were found');
      };

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
