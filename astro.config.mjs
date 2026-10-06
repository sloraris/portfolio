import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sloraris.dev',
  integrations: [sitemap()],
  // Keep whitespace between inline elements the way the old site had it.
  compressHTML: true,
  // With the ClientRouter every click would otherwise wait for a round trip to the server (invisible on localhost,
  // noticeable on GitHub Pages). Prefetching the pages behind visible links makes navigation instant.
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  vite: {
    plugins: [tailwindcss()],
  },
});
