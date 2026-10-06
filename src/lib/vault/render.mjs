import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';
import { stripComments } from './comments.mjs';
import { remarkObsidian, remarkTitle, remarkExcerpt } from './plugins.mjs';
import { slugify } from './scan.mjs';

const WORDS_PER_MINUTE = 225;

/** Collects h2-h4 (id + text) after rehype-slug has run; feeds the table of contents. */
function rehypeHeadings(sink) {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (/^h[2-4]$/.test(node.tagName) && node.properties?.id) {
        sink.push({ depth: Number(node.tagName[1]), id: String(node.properties.id), text: hastToString(node).trim() });
      }
    });
  };
}

/** Counts words from the final tree so embeds, callouts etc. are all included. */
function rehypeReadingTime(sink) {
  return (tree) => {
    const words = hastToString(tree).split(/\s+/).filter(Boolean).length;
    sink.words = words;
    sink.minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  };
}

/**
 * Copies attachments into `<publicDir>/media/<post-slug>/` and returns the URL.
 * Only files actually referenced by a published note are ever copied.
 */
export function createAssetEmitter(publicDir) {
  const claimed = new Map(); // url -> source abs path

  return function emitAsset(abs, slug) {
    const ext = path.extname(abs).toLowerCase();
    const base = slugify(path.basename(abs, path.extname(abs))) || 'file';
    let file = `${base}${ext}`;
    let n = 2;
    while (claimed.has(`${slug}/${file}`) && claimed.get(`${slug}/${file}`) !== abs) {
      file = `${base}-${n++}${ext}`;
    }
    claimed.set(`${slug}/${file}`, abs);

    const destDir = path.join(publicDir, 'media', slug);
    const dest = path.join(destDir, file);
    const src = fs.statSync(abs);
    if (!fs.existsSync(dest) || fs.statSync(dest).size !== src.size || fs.statSync(dest).mtimeMs < src.mtimeMs) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(abs, dest);
    }
    return `/media/${slug}/${file}`;
  };
}

/**
 * Render one note to HTML.
 * @returns {Promise<{ html: string, headings: {depth:number,id:string,text:string}[], readingTime: number, words: number, h1?: string, excerpt?: string }>}
 */
export async function renderNote(note, vault, { emitAsset, shikiTheme = 'night-owl' }) {
  const headings = [];
  const stats = { words: 0, minutes: 1 };

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkTitle, { frontTitle: note.data.title })
    .use(remarkObsidian, { note, vault, emitAsset })
    .use(remarkExcerpt)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeShiki, { theme: shikiTheme, fallbackLanguage: 'text' })
    .use(rehypeHeadings, headings)
    .use(rehypeReadingTime, stats)
    .use(rehypeStringify);

  const file = await processor.process({ value: stripComments(note.body), data: {} });

  return {
    html: String(file),
    headings,
    readingTime: stats.minutes,
    words: stats.words,
    h1: file.data.h1,
    excerpt: file.data.excerpt,
  };
}
