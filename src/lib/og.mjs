// Open Graph (link preview) images, made at build time.
//
// Each page's preview comes from, in order:
//   1. `ogImage:` in the note's frontmatter (an override, rarely needed)
//   2. the note's cover image, cropped to 1200x630 and compressed (the full-size cover is not served for previews)
//   3. a generated card: the title over the cosmic background (no description, by design)
//
// Used by src/pages/og/[slug].jpg.ts and src/pages/og-default.jpg.ts.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// Pinned to 0.34.1 in package.json: 0.35 and 0.36 crash with "__dirname is not defined" when imported from an ES module
import satori from 'satori';
import sharp from 'sharp';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const require = createRequire(path.join(process.cwd(), 'package.json'));
let fontData;
function titleFont() {
  // satori reads TTF/OTF/WOFF (not WOFF2), so use the static Exo 2 package's .woff rather than the variable .woff2 the site loads
  fontData ??= fs.readFileSync(require.resolve('@fontsource/exo-2/files/exo-2-latin-700-normal.woff'));
  return fontData;
}

/** Shrinks long titles so they still fit in at most four lines. */
export function titleSize(title) {
  const n = title.length;
  if (n <= 28) return 92;
  if (n <= 48) return 80;
  if (n <= 72) return 68;
  if (n <= 100) return 56;
  return 46;
}

const el = (type, style, children) => ({ type, props: { style, children } });

/** The generated card: title over the cosmic background, with the site name in the corner. */
export async function generatedCard({ title, siteName, publicDir }) {
  const markup = el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px 80px',
      // darkest on the left where the text sits, so the nebula still shows on the right
      backgroundImage: 'linear-gradient(90deg, rgba(8, 6, 22, 0.88) 0%, rgba(8, 6, 22, 0.55) 60%, rgba(8, 6, 22, 0.25) 100%)',
    },
    [
      el('div', { width: 112, height: 8, borderRadius: 4, backgroundImage: 'linear-gradient(90deg, #a78bfa, #fb923c)' }, ''),
      el(
        'div',
        { display: 'flex', fontSize: titleSize(title), lineHeight: 1.1, color: '#ffffff', fontWeight: 700, lineClamp: 4, maxWidth: 1000 },
        title,
      ),
      el('div', { display: 'flex', fontSize: 34, color: 'rgba(255, 255, 255, 0.72)', fontWeight: 700 }, siteName),
    ],
  );

  const svg = await satori(markup, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [{ name: 'Exo 2', data: titleFont(), weight: 700, style: 'normal' }],
  });
  const background = await sharp(path.join(publicDir, 'cosmic-hero.webp'))
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .toBuffer();
  return sharp(background)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/** A cover (any size or ratio) as a 1200x630 JPEG, centre-cropped. */
export function coverToOg(input) {
  return sharp(input)
    .rotate() // honour the EXIF orientation of photos
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#0b0a1a' }) // transparent PNGs would otherwise turn black in the JPEG
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

async function loadSource(source, publicDir) {
  if (/^(https?:)?\/\//.test(source)) {
    const res = await fetch(source.startsWith('//') ? `https:${source}` : source);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const abs = path.resolve(publicDir, source.replace(/^\/+/, ''));
  if (!abs.startsWith(path.resolve(publicDir) + path.sep)) throw new Error('outside public/');
  return fs.readFileSync(abs);
}

/**
 * The preview image for one page.
 * @param {{ title: string, source?: string, siteName: string, publicDir: string, warn?: (m: string) => void }} opts
 *   `source` is the cover or `ogImage` (a /media/... path or URL); without one, or if it can't be read, the card is generated.
 */
export async function renderOgImage({ title, source, siteName, publicDir, warn = console.warn }) {
  if (source) {
    try {
      return await coverToOg(await loadSource(source, publicDir));
    } catch (err) {
      warn(`[og] "${title}": could not use ${source} (${err.message}); generating a card instead`);
    }
  }
  return generatedCard({ title, siteName, publicDir });
}
