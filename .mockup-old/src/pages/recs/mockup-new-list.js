const $ = (id) => document.getElementById(id);
addEventListener('DOMContentLoaded', () => {
  const button = $('new-list-button'), menu = $('new-list-menu');
  button.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)); });
  $('new-list-cancel').addEventListener('click', () => { menu.hidden = true; });
  $('new-list-go').addEventListener('click', () => { location.search = '?landing'; });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.hidden = true; });
  if (location.search.includes('menu')) setTimeout(() => button.click(), 1200);
});
