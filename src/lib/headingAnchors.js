// A "#" after each h2-h4 in an article. It shows on hover/focus (always, dimly, on touch screens) and copies the link to
// that section. `astro:page-load` fires on the first load and after every page transition (ClientRouter).

function init() {
  for (const h of document.querySelectorAll('.post-prose :is(h2, h3, h4)[id]')) {
    if (h.querySelector('.heading-anchor')) continue;
    const label = h.textContent.trim();
    const a = document.createElement('a');
    a.className = 'heading-anchor';
    a.href = `#${h.id}`;
    a.textContent = '#';
    a.setAttribute('aria-label', `Copy link to the section "${label}"`);
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      history.replaceState(null, '', a.hash);
      const url = new URL(a.hash, location.href).href;
      navigator.clipboard?.writeText(url).then(
        () => {
          a.dataset.copied = '';
          setTimeout(() => delete a.dataset.copied, 1600);
        },
        () => {}, // clipboard not allowed here: the address bar already has the link
      );
    });
    h.append(' ', a);
  }
}

document.addEventListener('astro:page-load', init);
