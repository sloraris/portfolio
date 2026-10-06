import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_PROJECT_WEIGHT } from './projectConstants.mjs';

/** Published posts, newest first. Pages (type: page) and projects (type: project) are not included. */
export async function getPosts() {
  const posts = await getCollection('posts', ({ data }) => data.type === 'post');
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Standalone pages written as notes with `type: page` (About, etc.). */
export async function getPages() {
  return getCollection('posts', ({ data }) => data.type === 'page');
}

export async function hasPage(slug: string) {
  return (await getPages()).some((p) => p.data.slug === slug);
}

type Project = CollectionEntry<'posts'>;

const byDateDesc = (a: Project, b: Project) => b.data.date.valueOf() - a.data.date.valueOf();
const byWeightThenDate = (a: Project, b: Project) =>
  (a.data.weight ?? DEFAULT_PROJECT_WEIGHT) - (b.data.weight ?? DEFAULT_PROJECT_WEIGHT) || byDateDesc(a, b);

const isArchived = (p: Project) => p.data.status === 'archived';
const isFeatured = (p: Project) => p.data.featured === true && !isArchived(p);

/**
 * Published projects in display order: featured ones first (by `weight`, then newest),
 * then the rest newest first, with archived projects last.
 */
export async function getProjects() {
  const projects = await getCollection('posts', ({ data }) => data.type === 'project');
  return [
    ...projects.filter(isFeatured).sort(byWeightThenDate),
    ...projects.filter((p) => !isFeatured(p) && !isArchived(p)).sort(byDateDesc),
    ...projects.filter(isArchived).sort(byDateDesc),
  ];
}

/** Featured projects for the home page, in the same order as /projects/. */
export async function getFeaturedProjects(limit = 4) {
  return (await getProjects()).filter(isFeatured).slice(0, limit);
}

export async function hasProjects() {
  return (await getProjects()).length > 0;
}
