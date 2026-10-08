// Content script for bandcamp.com. Adds a "daily recs" tab next to collection / wishlist / followers on the user's OWN
// profile, and shows the extension page in an iframe under it. The Bandcamp-style player bar lives in this page (the
// audio plays inside the iframe; the bar only draws state and sends commands).
// Classic script: content scripts can't import modules, so the few shared constants are repeated here.
(() => {
  const TAB_CLASS = 'dr-tab';
  const HASH = '#dailyrecs';
  const EXTENSION_ORIGIN = new URL(chrome.runtime.getURL('')).origin;
  const WISHLIST_OP_MESSAGE = 'wishlist-op';           // keep in sync with MSG.WISHLIST_OP (src/lib/messages.js)
  const OPS = ['add', 'remove'];
  const MAX_TOAST_LENGTH = 200;
  const TOAST_MS = 4500;
  const REINJECT_DELAY_MS = 150;
  const TOOLBAR_RECHECK_MS = [400, 1500];

  const WAIT_FOR_TABS_MS = 10000;

  /** Calls `callback` with the profile's tab bar as soon as it exists (Bandcamp renders it client-side). */
  function whenTabsExist(callback) {
    const found = document.getElementById('grid-tabs');
    if (found) { callback(found); return; }
    const observer = new MutationObserver(() => {
      const tabs = document.getElementById('grid-tabs');
      if (!tabs) return;
      observer.disconnect();
      callback(tabs);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), WAIT_FOR_TABS_MS); // not a collection page: stop looking
  }

  function start(tabsContainer) {
  const state = { tab: null, countEl: null, frame: null, bar: null, isOpen: false, lastNow: null };
  const isNumericId = (value) => /^\d{1,20}$/.test(String(value));

  // ── Page facts ────────────────────────────────────────────────────────────────────────────────────────────────

  function readPageData() {
    try { return JSON.parse(document.querySelector('#pagedata').dataset.blob); } catch { return null; }
  }

  async function isOwnPage(data) {
    if (!data || !data.fan_data) return false;
    if (data.fan_data.is_own_page) return true;
    try { // fallback: is the signed-in fan the owner of this page?
      const summary = await (await fetch('/api/fan/2/collection_summary', { credentials: 'include' })).json();
      return Boolean(summary) && !summary.error && String(summary.fan_id) === String(data.fan_data.fan_id);
    } catch { return false; }
  }

  /** Albums of the list being used today (the one the user picked) that were neither hidden nor opened yet: the same number as on the toolbar icon. */
  async function countNewAlbums() {
    const { state: stored, opened, pickedDate: picked } = await chrome.storage.local.get(['state', 'opened', 'pickedDate']);
    if (!stored) return 0;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lists = [stored.today, stored.surprise, ...Object.values(stored.tagLists || {})].filter((list) => list && list.date === today);
    let list = null;
    if (picked && picked.date === today) { // the list the user picked, if it exists
      const key = [...new Set(picked.tags || [])].sort().join('+');
      list = picked.view === 'surprise' ? stored.surprise : picked.view === 'tags' ? (stored.tagLists || {})[key] : stored.today;
      if (!list || list.date !== today) list = null;
    }
    list = list || lists[0];
    if (!list) return 0;
    const gone = new Set(opened && opened.date === today ? opened.ids : []);
    const dismissed = new Set(stored.dismissed || []);
    // hidden from a genre list: hidden again only in lists that share a genre with that one (same rule as hiddenIn in src/lib/state.js)
    const hidden = (id) => dismissed.has(id) || Boolean((stored.scoped || {})[id] && list.tags && stored.scoped[id].keys.some((key) => list.tags.includes(key)));
    return list.ids.filter((id) => !gone.has(id) && !hidden(id)).length;
  }

  const collectionGrids = () => [...(tabsContainer.closest('#grids') || document).querySelectorAll('.grid')]
    .filter((grid) => grid.parentElement && grid.parentElement.id === 'grids');

  /**
   * The "search your collection / hide all / unhide all" bars exist only for the owner and have no stable id. There is one
   * per tab (collection, wishlist), and only the active tab's is visible, so every one is found through its search box
   * and climbed up to the largest block that contains neither the tabs, nor the grids, nor our panel.
   */
  function findToolbars() {
    const grids = collectionGrids();
    const toolbars = new Set();
    for (const input of document.querySelectorAll('input[placeholder*="search" i]')) {
      if (input.closest('#fan-bio-vm')) continue;
      let el = input;
      while (el.parentElement) {
        const parent = el.parentElement;
        const containsOurs = parent === document.body || parent.contains(tabsContainer) || (state.frame && parent.contains(state.frame));
        if (containsOurs || grids.some((grid) => parent.contains(grid))) break;
        el = parent;
      }
      toolbars.add(el);
    }
    return [...toolbars];
  }

  /** Hides the search bars. Bandcamp may draw the other tab's bar a moment after the switch, so it is repeated. */
  function hideToolbars() {
    findToolbars().forEach((toolbar) => toolbar.classList.add('dr-hidden'));
    TOOLBAR_RECHECK_MS.forEach((delay) => setTimeout(() => { if (state.isOpen) findToolbars().forEach((toolbar) => toolbar.classList.add('dr-hidden')); }, delay));
  }

  /** Aligns the panel with the other tabs' column (width and left edge of the tab bar). */
  function alignFrame() {
    if (!state.frame) return;
    const tabs = tabsContainer.getBoundingClientRect();
    const parent = state.frame.parentElement.getBoundingClientRect();
    state.frame.style.width = `${tabs.width}px`;
    state.frame.style.marginLeft = `${tabs.left - parent.left}px`;
  }
  window.addEventListener('resize', alignFrame);

  // ── Messages to / from the iframe ─────────────────────────────────────────────────────────────────────────────

  const sendCommand = (cmd, v) => state.frame && state.frame.contentWindow.postMessage({ dr: 'cmd', cmd, v }, EXTENSION_ORIGIN);

  let toastTimer = null;
  function showToast(message) {
    let el = document.getElementById('dr-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dr-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), TOAST_MS);
  }

  async function forwardWishlistRequest({ rid, op, id, bandId }) {
    const reply = (result) => state.frame && state.frame.contentWindow.postMessage({ dr: 'wishResult', rid, ...result }, EXTENSION_ORIGIN);
    try {
      const result = await chrome.runtime.sendMessage({ type: WISHLIST_OP_MESSAGE, op, id, bandId });
      reply({ ok: Boolean(result && result.ok), error: result && result.error });
    } catch (error) {
      reply({ ok: false, error: String((error && error.message) || error) });
    }
  }

  function handleFrameMessage(event) {
    const message = event.data;
    if (!state.frame || event.source !== state.frame.contentWindow || event.origin !== EXTENSION_ORIGIN) return;
    if (!message || typeof message !== 'object') return;
    switch (message.dr) {
      case 'height':
        if (Number.isFinite(message.h) && message.h > 0 && message.h < 100000) state.frame.style.height = `${Math.ceil(message.h)}px`;
        break;
      case 'wish':
        if (Number.isInteger(message.rid) && OPS.includes(message.op) && isNumericId(message.id) && isNumericId(message.bandId)) forwardWishlistRequest(message);
        break;
      case 'toast':
        if (typeof message.msg === 'string') showToast(message.msg.slice(0, MAX_TOAST_LENGTH));
        break;
      case 'now':
        // Updates are partial: the queue is only included when it changed, so keep the last one.
        state.lastNow = { ...message, queue: message.queue !== undefined ? message.queue : state.lastNow && state.lastNow.queue };
        renderBar();
        break;
      default:
    }
  }
  window.addEventListener('message', handleFrameMessage);

  // ── Player bar ────────────────────────────────────────────────────────────────────────────────────────────────

  function ensureBar() {
    if (state.bar) return state.bar;
    state.bar = BCPlayer.create({
      spriteUrl: chrome.runtime.getURL('src/assets/nextprev.png'),
      busyUrl: chrome.runtime.getURL('src/assets/playerbusy.gif'),
      onCmd: sendCommand,
    });
    document.body.appendChild(state.bar.el);
    return state.bar;
  }

  function renderBar() {
    const show = state.isOpen && state.lastNow && state.lastNow.has;
    if (!state.bar && !show) return;
    ensureBar().update({ ...(state.lastNow || {}), has: Boolean(show) });
    document.body.classList.toggle('dr-player-on', Boolean(show));
  }

  // ── Opening and closing the panel ─────────────────────────────────────────────────────────────────────────────

  function createFrame() {
    const frame = document.createElement('iframe');
    frame.id = 'dr-frame';
    frame.allow = 'autoplay';
    frame.title = "Daily Recs: today's recommendations";
    frame.scrolling = 'no';
    frame.src = chrome.runtime.getURL('src/pages/recs/recs.html');
    const anchor = document.querySelector('.grid-tabs-anchor') || tabsContainer.parentElement;
    anchor.insertAdjacentElement('afterend', frame);
    return frame;
  }

  function openPanel() {
    state.isOpen = true;
    tabsContainer.querySelectorAll('li').forEach((tab) => tab.classList.toggle('active', tab === state.tab));
    collectionGrids().forEach((grid) => grid.classList.add('dr-hidden'));
    document.body.classList.add('dr-open');                                     // hides Bandcamp's own player (CSS)
    document.querySelectorAll('audio').forEach((audio) => audio.pause());       // ...and stops whatever it was playing
    if (!state.frame) state.frame = createFrame();
    state.frame.hidden = false; // hidden (not removed) on exit, so the music keeps playing
    alignFrame();
    hideToolbars();
    renderBar();
    history.replaceState(null, '', HASH);
  }

  function closePanel() {
    state.isOpen = false;
    sendCommand('pause'); // the bar disappears, so don't leave it playing in the dark
    renderBar();
    document.querySelectorAll('.dr-hidden').forEach((el) => el.classList.remove('dr-hidden'));
    document.body.classList.remove('dr-open');
    state.tab.classList.remove('active');
    if (state.frame) state.frame.hidden = true;
  }

  async function injectTab() {
    if (tabsContainer.querySelector(`.${TAB_CLASS}`)) return;
    if (!(await isOwnPage(readPageData()))) return;
    const tab = document.createElement('li');
    tab.className = TAB_CLASS;
    tab.dataset.tab = 'dailyrecs';
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = 'daily recs';
    const badge = document.createElement('span');
    badge.className = 'dr-new-tag'; // same look as Bandcamp's "NEW" tag on the playlists tab
    title.append(badge);
    tab.append(title);
    tabsContainer.appendChild(tab);
    state.tab = tab;
    state.countEl = badge;
    updateTabCount();
    if (location.hash === HASH) openPanel();
  }

  /** "daily recs 35 new": the number follows the albums being opened or rejected. */
  async function updateTabCount() {
    if (!state.countEl) return;
    const count = await countNewAlbums();
    state.countEl.textContent = count ? `${count} new` : '';
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.state || changes.opened || changes.pickedDate)) updateTabCount();
  });

  // The toolbar icon reuses the profile tab by changing only the hash (no reload), so listen for it.
  window.addEventListener('hashchange', () => { if (state.tab && location.hash === HASH) openPanel(); });

  // Captured before Bandcamp's own handlers: our tab must not go through them (they don't know "dailyrecs").
  document.addEventListener('click', (event) => {
    if (!state.tab) return;
    if (event.target.closest(`.${TAB_CLASS}`)) {
      event.stopPropagation();
      event.preventDefault();
      openPanel();
    } else if (event.target.closest('#grid-tabs li') && state.frame && !state.frame.hidden) {
      closePanel(); // another tab: let Bandcamp carry on
    }
  }, true);

  // Bandcamp may redraw the tab bar; put our tab back if it disappears.
  let reinjectTimer = null;
  new MutationObserver(() => {
    clearTimeout(reinjectTimer);
    reinjectTimer = setTimeout(() => {
      if (tabsContainer.querySelector(`.${TAB_CLASS}`)) return;
      state.tab = null;
      injectTab();
    }, REINJECT_DELAY_MS);
  }).observe(tabsContainer, { childList: true });

  injectTab();
  }

  whenTabsExist(start);
})();
