import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { vaultLoader } from './lib/vault/loader.mjs';

// Frontmatter is deliberately not validated here: notes only need `publish: true`.
// Everything below is derived by the vault loader (title from the first heading or
// filename, date from frontmatter or git history, description from the first paragraph).
const posts = defineCollection({
  loader: vaultLoader(),
  schema: z.object({
    slug: z.string(),
    type: z.enum(['post', 'page', 'project']),
    title: z.string(),
    description: z.string(),
    date: z.date(),
    updated: z.date().optional(),
    tags: z.array(z.string()),
    cover: z.string().optional(),
    ogImage: z.string().optional(), // optional override for the link preview; otherwise the cover, otherwise a generated card
    readingTime: z.number(),
    headings: z.array(z.object({ depth: z.number(), id: z.string(), text: z.string() })),
    html: z.string(),
    source: z.string(),
    draft: z.boolean().optional(), // dev server only: an unpublished note shown by `pnpm dev:drafts`
    // Project-only (type: project); absent on posts and pages. See projectFields() in lib/vault/posts.mjs.
    status: z.enum(['active', 'finished', 'archived']).optional(),
    featured: z.boolean().optional(),
    weight: z.number().optional(),
    stack: z.array(z.string()).optional(),
    repo: z.string().optional(),
    demo: z.string().optional(),
    writeup: z.string().optional(),
  }),
});

export const collections = { posts };
