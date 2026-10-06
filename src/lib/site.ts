export const tagSlug = (tag: string) =>
  tag
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Dates from frontmatter are UTC midnight; format in UTC so "2025-07-06" never shows as the 5th.
export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);

export const postHref = (slug: string) => `/posts/${slug}/`;
export const projectHref = (slug: string) => `/projects/${slug}/`;
export const pageHref = (slug: string) => `/${slug}/`;
