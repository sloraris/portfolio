import rss from '@astrojs/rss';
import { getPosts } from '../lib/content';
import { SITE } from '../config';

export async function GET(context) {
  const posts = await getPosts();
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/posts/${post.data.slug}/`,
      categories: post.data.tags,
    })),
  });
}
