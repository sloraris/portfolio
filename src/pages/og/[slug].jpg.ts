// /og/<slug>.jpg: the link-preview image of every note (posts, projects, pages). See src/lib/og.mjs.
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../../config';
import { renderOgImage } from '../../lib/og.mjs';

export const getStaticPaths = (async () => {
  const entries = await getCollection('posts');
  return entries.map(({ data }) => ({
    params: { slug: data.slug },
    props: { title: data.title, source: data.ogImage ?? data.cover },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const body = await renderOgImage({
    title: props.title,
    source: props.source,
    siteName: new URL(SITE.url).hostname,
    publicDir: path.resolve('public'),
  });
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/jpeg' } });
};
