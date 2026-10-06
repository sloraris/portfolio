// Table-of-contents progress: one script feeds two places.
//  - xl and up: the ToC pill (#toc-pill). Expanded at the very top of the page, collapsed into a slim bar of ticks +
//    progress once the page scrolls. Hover (mouse / pen) or keyboard focus expands it again; the bar is also a
//    toggle that pins it open.
//  - below xl: the ToC button in the middle of the nav pill (.nav-toc-btn, see mobileMenu.js for opening the list).
//  Both show the same tick bar: ticks mirror the headings (passed ones tinted, the one being read lit) and the
//  percentage is how far through the article you are.

const EDGE = 8; // px of slack at the very top
const TICK_MIN = 4;  // px, narrowest a tick gets before the bar starts scrolling instead of squeezing
const TICK_MAX = 10; // px, widest a tick gets when there are only a few headings
const TICK_GAP = 3;  // px

let controller; // document / window listeners, replaced on every page load so they never pile up

function initToc() {
  const pill = document.getElementById('toc-pill');
  const mobileBtn = document.querySelector('.nav-toc-btn');
  if (!pill && !mobileBtn) return;
  if ((pill ?? mobileBtn).dataset.tocReady) return;
  if (pill) pill.dataset.tocReady = 'true';
  if (mobileBtn) mobileBtn.dataset.tocReady = 'true';

  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  // ---- pin + hover (desktop pill only) ----
  if (pill) {
    const bar = pill.querySelector('.toc-bar');
    bar.addEventListener('click', () => {
      const pinned = !pill.hasAttribute('data-pinned');
      pill.toggleAttribute('data-pinned', pinned);
      bar.setAttribute('aria-pressed', String(pinned));
      bar.title = pinned ? 'Let this list collapse while scrolling' : 'Keep this list open';
    });
    // hover is done here instead of with :hover, so a tap on a touch screen does not leave it stuck open
    pill.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') pill.setAttribute('data-hover', ''); }, { signal });
    pill.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') pill.removeAttribute('data-hover'); }, { signal });
  }

  // ---- tick bars: with few headings the ticks stretch to fill the bar. With more than fit at TICK_MIN, the bar
  // becomes a window onto the row of ticks that slides along as you read, fading out where more ticks are hidden. ----
  const bars = [...document.querySelectorAll('.toc-ticks')].map((box) => {
    const root = box.closest('[data-ids]');
    return {
      box,
      root,
      track: box.querySelector('.toc-ticks-track'),
      ticks: [...box.querySelectorAll('.toc-tick')],
      ids: (root?.dataset.ids ?? '').split('|').filter(Boolean),
      tickW: TICK_MAX,
      capacity: 0,
    };
  });
  const percents = [...document.querySelectorAll('.toc-percent')];

  const layoutTicks = () => {
    for (const bar of bars) {
      const room = bar.box.clientWidth; // 0 while the bar is display:none (the desktop one on a phone)
      const n = bar.ticks.length;
      if (!room || !n) continue;
      bar.capacity = Math.max(1, Math.floor((room + TICK_GAP) / (TICK_MIN + TICK_GAP)));
      bar.tickW = n <= bar.capacity
        ? Math.min(TICK_MAX, Math.floor((room - (n - 1) * TICK_GAP) / n))
        : TICK_MIN;
      bar.box.style.setProperty('--tick-w', `${bar.tickW}px`);
      bar.box.style.setProperty('--tick-gap', `${TICK_GAP}px`);
    }
  };
  const slideTicks = (bar, current) => {
    const n = bar.ticks.length;
    if (!bar.capacity) return;
    const cap = Math.min(n, bar.capacity);
    const start = n <= cap ? 0 : Math.min(n - cap, Math.max(0, current - Math.floor(cap / 2)));
    bar.track.style.transform = `translateX(${-start * (bar.tickW + TICK_GAP)}px)`;
    bar.box.toggleAttribute('data-more-l', start > 0);
    bar.box.toggleAttribute('data-more-r', start + cap < n);
  };

  const article = document.querySelector('.site-main article') ?? document.querySelector('.site-main');
  let frame = 0;

  const update = () => {
    frame = 0;
    const y = window.scrollY;
    pill?.toggleAttribute('data-scrolled', y > EDGE);

    // reading progress through the article
    if (article) {
      const top = article.getBoundingClientRect().top + y;
      const span = article.offsetHeight - window.innerHeight * 0.6;
      const p = span > 0 ? Math.min(1, Math.max(0, (y - top + 80) / span)) : 0;
      for (const el of percents) el.textContent = `${Math.round(p * 100)}%`;
    }

    // the heading being read: the last one that has reached the top part of the window
    for (const bar of bars) {
      let current = -1;
      bar.ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = i;
      });
      bar.ticks.forEach((t, i) => {
        t.classList.toggle('is-past', i < current);
        t.classList.toggle('is-current', i === current);
      });
      slideTicks(bar, Math.max(current, 0));
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', () => { layoutTicks(); schedule(); }, { signal });
  window.addEventListener('load', schedule, { signal });
  layoutTicks();
  update();
  document.fonts?.ready.then(() => { layoutTicks(); update(); });
}

document.addEventListener('astro:page-load', initToc);
if (document.readyState !== 'loading') initToc();
