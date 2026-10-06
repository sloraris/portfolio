// Turns a vault into a list of publishable posts. Used by the Astro content
// loader and by the tests.

import fs from 'node:fs';
import path from 'node:path';
import { scanVault, coerceDate, gitFirstCommitDate, slugify, noteUrl } from './scan.mjs';
import { createAssetEmitter, renderNote } from './render.mjs';
import { PROJECT_STATUSES, DEFAULT_PROJECT_WEIGHT } from '../projectConstants.mjs';

function normalizeTags(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,\s]+/) : [];
  return [...new Set(list.map((t) => String(t).replace(/^#/, '').trim().toLowerCase()).filter(Boolean))];
}

// ------------------------------------------------------------------ projects (type: project)

const isTruthy = (v) => v === true || (typeof v === 'string' && ['true', 'yes'].includes(v.trim().toLowerCase()));

/** Tech names keep their case ("TypeScript"), unlike tags. Duplicates are dropped case-insensitively. */
function normalizeStack(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const value = String(item).trim();
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      out.push(value);
    }
  }
  return out;
}

/** The project-only properties. Bad values warn and fall back; they never fail the build. */
function projectFields(note, vault, warn) {
  const fm = note.data;
  const redact = Boolean(process.env.CI);

  let status = 'active';
  if (fm.status != null && fm.status !== '') {
    const wanted = String(fm.status).trim().toLowerCase();
    if (PROJECT_STATUSES.includes(wanted)) status = wanted;
    else warn(`[vault] ${note.relPath}: status "${fm.status}" is not one of ${PROJECT_STATUSES.join(' | ')}; using "active"`);
  }

  let weight = DEFAULT_PROJECT_WEIGHT;
  if (fm.weight != null && fm.weight !== '') {
    const n = Number(fm.weight);
    if (Number.isFinite(n)) weight = n;
    else warn(`[vault] ${note.relPath}: weight "${fm.weight}" is not a number; using ${DEFAULT_PROJECT_WEIGHT}`);
  }

  // These end up in href attributes, so only http(s) URLs are accepted.
  const url = (field) => {
    const raw = fm[field];
    if (raw == null || raw === '') return undefined;
    const value = String(raw).trim();
    if (/^https?:\/\/\S+$/i.test(value)) return value;
    warn(`[vault] ${note.relPath}: ${field} must be an http(s) URL; ignoring "${value}"`);
    return undefined;
  };

  // `writeup: "[[Some Post]]"` (or a plain note name / http URL). Only a published note is linked.
  let writeup;
  if (fm.writeup != null && fm.writeup !== '') {
    const raw = String(fm.writeup).trim();
    if (/^https?:\/\/\S+$/i.test(raw)) {
      writeup = raw;
    } else {
      const name = raw.replace(/^\[\[|\]\]$/g, '').split('|')[0].split('#')[0].trim();
      const target = name ? vault.findNote(name, note) : null;
      if (target?.published && target !== note) writeup = noteUrl(target);
      else {
        warn(
          redact
            ? '[vault] a project writeup points to an unpublished or missing note; ignoring it'
            : `[vault] ${note.relPath}: writeup "${raw}" points to ${target ? 'an unpublished note' : 'a note that does not exist'}; ignoring it`,
        );
      }
    }
  }

  return {
    status,
    featured: isTruthy(fm.featured),
    weight,
    stack: normalizeStack(fm.stack),
    repo: url('repo'),
    demo: url('demo'),
    writeup,
  };
}

export async function buildPosts(contentDir, { publicDir = path.resolve('public'), warn = console.warn } = {}) {
  const vault = scanVault(contentDir, { warn });
  const emitAsset = createAssetEmitter(publicDir);

  const resolveCover = (note, value) => {
    if (!value) return undefined;
    const cleaned = String(value).replace(/^!?\[\[|\]\]$/g, '').split('|')[0].trim();
    if (/^(https?:)?\/\//.test(cleaned) || cleaned.startsWith('/')) return cleaned;
    const abs = vault.findAttachment(cleaned, note);
    if (!abs) {
      warn(`[vault] ${note.relPath}: cover image not found: ${cleaned}`);
      return undefined;
    }
    return emitAsset(abs, note.slug);
  };

  const posts = [];
  for (const note of vault.published) {
    const fm = note.data;
    const rendered = await renderNote(note, vault, { emitAsset });

    let date =
      coerceDate(fm.date ?? fm.created ?? fm.pubDate ?? fm.pubdate) ??
      gitFirstCommitDate(vault.root, note.relPath);
    if (!date) {
      date = fs.statSync(note.absPath).mtime;
      if (fm.type !== 'page') warn(`[vault] ${note.relPath}: no date property and no git history; using the file's modified time. Add \`date: YYYY-MM-DD\`.`);
    }

    const type = fm.type === 'page' ? 'page' : fm.type === 'project' ? 'project' : 'post';

    posts.push({
      id: note.slug,
      slug: note.slug,
      type,
      title: String(fm.title ?? rendered.h1 ?? note.name),
      description: String(fm.description ?? rendered.excerpt ?? ''),
      date,
      updated: coerceDate(fm.updated ?? fm.modified ?? fm.lastmod) ?? undefined,
      tags: normalizeTags(fm.tags ?? fm.tag),
      cover: resolveCover(note, fm.cover ?? fm.image ?? fm.heroImage ?? fm.banner),
      readingTime: rendered.readingTime,
      headings: rendered.headings,
      html: rendered.html,
      source: note.relPath,
      ...(type === 'project' ? projectFields(note, vault, warn) : {}),
    });
  }

  posts.sort((a, b) => b.date.valueOf() - a.date.valueOf());
  return { posts, vault };
}

export { slugify };
