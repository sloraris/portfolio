// The quote machine on the home hero reads its lines from a published note: `type: page`, `slug: quotes` (the
// "Quotes" page, which is also the easter egg the machine links to). Every list item on that page is one quote (an
// item that only holds a nested list is a group label, not a quote); headings and paragraphs are ignored, so the
// page can group them by source and say what it likes.
// No such note (or no list in it): a single line, which the hero just shows, without the animation.

export const QUOTES_SLUG = 'quotes';
export const FALLBACK_QUOTES = ['Hello, world!'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (m, dec, hex, name) =>
    dec ? String.fromCodePoint(+dec) : hex ? String.fromCodePoint(parseInt(hex, 16)) : (ENTITIES[name.toLowerCase()] ?? m),
  );

/** The quotes in a page's rendered HTML: the text of each innermost list item, in order, without repeats. */
export function parseQuotes(html) {
  const found = [];
  // an <li> with no other <li> inside it
  for (const [, inner] of String(html ?? '').matchAll(/<li\b[^>]*>((?:(?!<li\b|<\/li>)[\s\S])*)<\/li>/gi)) {
    const text = decode(inner.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
    if (text && !found.includes(text)) found.push(text);
  }
  return found;
}

/** What the hero shows: the quotes of the page (an object with `data.html`), or the one-line fallback. */
export function heroQuotesFrom(page) {
  const quotes = parseQuotes(page?.data?.html);
  return quotes.length ? quotes : FALLBACK_QUOTES;
}
