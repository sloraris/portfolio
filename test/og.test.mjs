import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { renderOgImage, titleSize, OG_WIDTH, OG_HEIGHT } from '../src/lib/og.mjs';

// Build a throwaway public/ folder with the background image and one wide cover.
async function publicDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-test-'));
  fs.copyFileSync(path.resolve('public/cosmic-hero.webp'), path.join(dir, 'cosmic-hero.webp'));
  fs.mkdirSync(path.join(dir, 'media/post'), { recursive: true });
  await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#a855f7' } })
    .png()
    .toFile(path.join(dir, 'media/post/cover.png'));
  return dir;
}
const opts = { title: 'A title', siteName: 'example.dev' };

test('a cover becomes a 1200x630 JPEG', async () => {
  const dir = await publicDir();
  const out = await renderOgImage({ ...opts, source: '/media/post/cover.png', publicDir: dir });
  const meta = await sharp(out).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', OG_WIDTH, OG_HEIGHT]);
  assert.ok(out.length < 300_000, `preview is ${out.length} bytes`);
});

test('without a cover, a 1200x630 card is generated', async () => {
  const dir = await publicDir();
  const out = await renderOgImage({ ...opts, publicDir: dir });
  const meta = await sharp(out).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', OG_WIDTH, OG_HEIGHT]);
});

test('a missing cover warns and falls back to the generated card', async () => {
  const dir = await publicDir();
  const warnings = [];
  const out = await renderOgImage({ ...opts, source: '/media/post/gone.png', publicDir: dir, warn: (m) => warnings.push(m) });
  assert.equal((await sharp(out).metadata()).width, OG_WIDTH);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /gone\.png/);
});

test('a source outside public/ is refused', async () => {
  const dir = await publicDir();
  const warnings = [];
  await renderOgImage({ ...opts, source: '/../../../etc/passwd', publicDir: dir, warn: (m) => warnings.push(m) });
  assert.match(warnings[0], /outside public/);
});

test('long titles get a smaller font', () => {
  assert.ok(titleSize('x'.repeat(120)) < titleSize('x'.repeat(60)));
  assert.ok(titleSize('x'.repeat(60)) < titleSize('short'));
});
