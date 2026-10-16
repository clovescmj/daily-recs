// Runs as soon as a bandcamp.com page starts loading (before the profile is drawn). When the page was opened on the "daily recs" tab
// (#dailyrecs, as the toolbar icon does), Bandcamp draws its own collection first and our tab replaces it a moment later. This marks the
// page so the stylesheet keeps the collection out of sight meanwhile; profile-tab.js lifts the mark when the panel is open.
(() => {
  let reopening = false;
  try { reopening = sessionStorage.getItem('dr-reopen') === '1'; } catch { /* no session storage: the address decides */ }   // (set by profile-tab.js before a reload)
  if (location.hash !== '#dailyrecs' && !reopening) return;
  const root = document.documentElement;
  root.classList.add('dr-pending');
  setTimeout(() => root.classList.remove('dr-pending'), 8000); // never leaves the profile blank, whatever happens
})();
