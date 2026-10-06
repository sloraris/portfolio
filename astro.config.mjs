import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sloraris.dev',
  integrations: [sitemap()],
  // Keep whitespace between inline elements the way the old site had it.
  compressHTML: true,
  vite: {
    plugins: [tailwindcss()],
  },
});
