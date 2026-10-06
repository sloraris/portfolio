// Nav pill.
//  - below xl: the menu button opens and closes the panel of tiles. On pages with a table of contents, the ToC button
//    in the middle of the bar opens a panel with the list instead (only one panel is open at a time). Tapping the
//    button again, a heading, outside the pill, or pressing Escape closes it, and so does growing the window to the
//    desktop layout.
//  - xl and up: the pill is compact (3 dots / logo / avatar) while the page is scrolling and expanded at the very
//    top, at the very bottom, while hovered (mouse and pen: data-expanded), while keyboard-focused (CSS), and
//    after a tap on the 3-dot button (touch). A tap expansion folds away again on the next scroll or an outside tap.

const DESKTOP = '(min-width: 80rem)'; // same breakpoint as the sidebars / inline nav links

let controller; // listeners on document / window, replaced on every page load so they never pile up

function initNavPill() {
  const pill = document.getElementById('nav-pill');
  if (!pill || pill.dataset.ready) return;
  pill.dataset.ready = 'true';

  const toggle = pill.querySelector('.nav-toggle');
  const panel = pill.querySelector('.nav-panel');
  const tocBtn = pill.querySelector('.nav-toc-btn');
  const tocPanel = pill.querySelector('.nav-toc-panel');
  const isMenuOpen = () => pill.hasAttribute('data-open');
  const isTocOpen = () => pill.hasAttribute('data-toc-open');
  const isOpen = () => isMenuOpen() || isTocOpen();

  const setTocOpen = (open, { restoreFocus = false } = {}) => {
    if (!tocBtn) return;
    if (open && isMenuOpen()) setOpen(false);
    pill.toggleAttribute('data-toc-open', open);
    tocBtn.setAttribute('aria-expanded', String(open));
    tocPanel.inert = !open;
    if (open) {
      // once the panel has grown, bring the section being read into view inside a long list
      setTimeout(() => {
        const inner = tocPanel.querySelector('.nav-toc-inner');
        const cur = tocPanel.querySelector('a[aria-current="true"]');
        if (!inner || !cur || !isTocOpen()) return;
        const offset = cur.getBoundingClientRect().top - inner.getBoundingClientRect().top + inner.scrollTop;
        inner.scrollTop = offset - inner.clientHeight / 2 + cur.offsetHeight / 2;
      }, 420);
    }
    if (!open && restoreFocus) tocBtn.focus();
  };

  const setOpen = (open, { restoreFocus = false } = {}) => {
    if (open && isTocOpen()) setTocOpen(false);
    pill.toggleAttribute('data-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    panel.inert = !open; // keeps the hidden links out of the tab order
    if (!open && restoreFocus) toggle.focus();
  };

  setOpen(false);
  setTocOpen(false);
  toggle.addEventListener('click', () => setOpen(!isMenuOpen()));
  tocBtn?.addEventListener('click', () => setTocOpen(!isTocOpen()));
  // choosing a heading jumps there and puts the list away
  tocPanel?.addEventListener('click', (e) => { if (e.target.closest('a')) setTocOpen(false); });

  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  document.addEventListener('click', (e) => {
    if (isOpen() && !pill.contains(e.target)) { setOpen(false); setTocOpen(false); }
  }, { signal });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isMenuOpen()) setOpen(false, { restoreFocus: true });
    else if (isTocOpen()) setTocOpen(false, { restoreFocus: true });
  }, { signal });

  window.matchMedia(DESKTOP).addEventListener('change', (e) => {
    if (e.matches) { setOpen(false); setTocOpen(false); }
  }, { signal });

  // Hover expands the pill. It is done here rather than with :hover so that touch screens, where :hover sticks
  // after a tap, only ever expand through the 3-dot button.
  let tapExpanded = false;
  let lastY = window.scrollY;
  const setExpanded = (on) => {
    tapExpanded = false;
    pill.toggleAttribute('data-expanded', on);
  };
  pill.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') setExpanded(true); }, { signal });
  pill.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') setExpanded(false); }, { signal });
  pill.querySelector('.nav-dots')?.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    pill.setAttribute('data-expanded', '');
    tapExpanded = true;
    lastY = window.scrollY;
  }, { signal });
  document.addEventListener('pointerdown', (e) => {
    if (tapExpanded && !pill.contains(e.target)) setExpanded(false);
  }, { signal });

  // Tell the page whether the pill is currently folded down (body[data-nav-collapsed]). The table-of-contents pill
  // uses it: on windows too narrow for both pills to share a row while the nav is expanded, it slides up beside
  // the folded nav and back down under the expanded one (see .toc-pill in global.css).
  const syncCollapsed = () => {
    const folded = pill.hasAttribute('data-compact')
      && !pill.hasAttribute('data-expanded')
      && !pill.matches(':has(:focus-visible)');
    document.body.toggleAttribute('data-nav-collapsed', folded);
  };
  const observer = new MutationObserver(syncCollapsed);
  observer.observe(pill, { attributes: true, attributeFilter: ['data-compact', 'data-expanded'] });
  signal.addEventListener('abort', () => observer.disconnect());
  pill.addEventListener('focusin', () => requestAnimationFrame(syncCollapsed), { signal });
  pill.addEventListener('focusout', () => requestAnimationFrame(syncCollapsed), { signal });

  // compact between the very top and the very bottom of the page
  const EDGE = 8; // px of slack at either end
  let frame = 0;
  const updateCompact = () => {
    frame = 0;
    if (tapExpanded && window.scrollY !== lastY) setExpanded(false);
    lastY = window.scrollY;
    const atTop = window.scrollY <= EDGE;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - EDGE;
    pill.toggleAttribute('data-compact', !(atTop || atBottom));
  };
  const scheduleCompact = () => { if (!frame) frame = requestAnimationFrame(updateCompact); };
  window.addEventListener('scroll', scheduleCompact, { passive: true, signal });
  window.addEventListener('resize', scheduleCompact, { signal });
  window.addEventListener('load', scheduleCompact, { signal });
  updateCompact();
  syncCollapsed();
}

// `astro:page-load` fires on the first load and after every page transition (ClientRouter).
document.addEventListener('astro:page-load', initNavPill);
if (document.readyState !== 'loading') initNavPill();
