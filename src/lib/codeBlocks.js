// Dresses up code blocks and tables in articles (.post-prose):
//  - each code block gets a header bar with the language (from data-language, set by the shiki transformer in
//    src/lib/vault/render.mjs) and a Copy button;
//  - each table is wrapped so it can scroll sideways inside a rounded frame instead of overflowing the page.
// `astro:page-load` fires on the first load and after every page transition (ClientRouter).

const PLAIN = new Set(['text', 'txt', 'plain', 'plaintext', 'ansi']);

function dressCode(pre) {
  if (pre.parentElement?.classList.contains('code-block')) return;
  const lang = (pre.dataset.language ?? '').toLowerCase();
  const wrap = document.createElement('div');
  wrap.className = 'code-block';

  const bar = document.createElement('div');
  bar.className = 'code-bar';
  const label = document.createElement('span');
  label.className = 'code-lang';
  label.textContent = PLAIN.has(lang) ? '' : lang;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'code-copy';
  btn.textContent = 'Copy';
  btn.setAttribute('aria-label', 'Copy code to the clipboard');
  let timer;
  btn.addEventListener('click', async () => {
    const text = (pre.querySelector('code') ?? pre).textContent.replace(/\n$/, '');
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
      btn.dataset.copied = '';
    } catch {
      btn.textContent = 'Press Ctrl+C';
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      btn.textContent = 'Copy';
      delete btn.dataset.copied;
    }, 1600);
  });
  bar.append(label, btn);

  pre.before(wrap);
  wrap.append(bar, pre);
}

function dressTable(table) {
  if (table.parentElement?.classList.contains('table-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  table.before(wrap);
  wrap.append(table);
  // a scrollable region needs to be reachable by keyboard, but only when it really scrolls
  const sync = () => {
    const scrolls = wrap.scrollWidth > wrap.clientWidth + 1;
    if (scrolls) {
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', 'Table (scrolls sideways)');
    } else {
      wrap.removeAttribute('tabindex');
      wrap.removeAttribute('role');
      wrap.removeAttribute('aria-label');
    }
  };
  sync();
  if ('ResizeObserver' in window) new ResizeObserver(sync).observe(wrap);
}

function init() {
  for (const pre of document.querySelectorAll('.post-prose pre.shiki')) dressCode(pre);
  for (const table of document.querySelectorAll('.post-prose table')) dressTable(table);
}

document.addEventListener('astro:page-load', init);
