// /og-default.jpg: the link-preview image for pages that are not a note (home, lists, 404). See src/lib/og.mjs.
import path from 'node:path';
import type { APIRoute } from 'astro';
import { SITE } from '../config';
import { renderOgImage } from '../lib/og.mjs';

export const GET: APIRoute = async () => {
  const body = await renderOgImage({
    title: SITE.author.tagline,
    siteName: new URL(SITE.url).hostname,
    publicDir: path.resolve('public'),
  });
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/jpeg' } });
};
