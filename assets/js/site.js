/* Shared behaviour: mobile menu, tabs, stacked-table labels, single-page routing (SPA build only). */
{
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // label table cells for the stacked mobile layout
  const label = () => { for (const c of $$('.stack td:not([data-l])')) { let i = 0, p = c; while ((p = p.previousElementSibling)) i += p.colSpan; c.dataset.l = c.closest('table').rows[0].cells[i]?.textContent || ''; } };
  new MutationObserver(label).observe(document.documentElement, { childList: true, subtree: true });
  label();

  // close mobile menu after choosing a link
  for (const a of $$('.menu nav a')) a.addEventListener('click', () => a.closest('details').removeAttribute('open'));

  // generic tabs: <div class="tabs" data-tabs="group"><button data-tab="id">..</button></div> + panels [data-panel="group:id"]
  for (const t of $$('.tabs[data-tabs]')) {
    const g = t.dataset.tabs;
    const show = id => {
      for (const b of $$('button', t)) b.setAttribute('aria-selected', String(b.dataset.tab === id));
      for (const p of $$(`[data-panel^="${g}:"]`)) p.hidden = p.dataset.panel !== `${g}:${id}`;
    };
    t.setAttribute('role', 'tablist');
    for (const b of $$('button', t)) { b.setAttribute('role', 'tab'); b.addEventListener('click', () => show(b.dataset.tab)); }
    show($$('button', t)[0].dataset.tab);
  }

  // in-page jumps that do not disturb hash routing
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-jump]');
    if (!a) return;
    const t = document.getElementById(a.getAttribute('href').slice(1));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  // SPA routing: only active when the page contains .view sections
  const views = $$('.view');
  if (views.length) {
    const route = () => {
      const id = (location.hash || '#index').slice(1);
      const v = document.getElementById('view-' + id) || document.getElementById('view-index');
      for (const x of views) x.hidden = x !== v;
      for (const a of $$('nav a')) a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + v.id.slice(5));
      document.title = (v.dataset.title || 'Grace Njoki Kimotho') + (v.id === 'view-index' ? '' : ' | Grace Njoki Kimotho');
      window.scrollTo(0, 0);
      window.dispatchEvent(new CustomEvent('view:shown', { detail: v.id.slice(5) }));
    };
    window.addEventListener('hashchange', route);
    route();
  }
}
