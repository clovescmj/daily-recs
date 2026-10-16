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

  /** Lifts the early "keep the collection out of sight" mark (early.js): the panel is open, or there is no panel to wait for. */
  const showProfile = () => document.documentElement.classList.remove('dr-pending');

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
    setTimeout(() => { observer.disconnect(); showProfile(); }, WAIT_FOR_TABS_MS); // not a collection page: stop looking
  }

  function start(tabsContainer) {
  const state = { tab: null, tagEl: null, frame: null, bar: null, isOpen: false, lastNow: null };
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

  /** The list of today was picked and none of its songs played yet: the tab says it is a new list. */
  async function hasNewList() {
    const { pickedDate: picked } = await chrome.storage.local.get('pickedDate');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return Boolean(picked && picked.date === today && !picked.played);
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

  /** A confirmation (a song added, a wishlist change): one line that goes away by itself. */
  function showToast(message) {
    DRNotice.show({
      id: 'toast',
      text: message,
      closable: false,
      autoHide: TOAST_MS,
    });
  }

  async function forwardWishlistRequest({ rid, op, id, bandId, itemType }) {
    const reply = (result) => state.frame && state.frame.contentWindow.postMessage({ dr: 'wishResult', rid, ...result }, EXTENSION_ORIGIN);
    try {
      const result = await chrome.runtime.sendMessage({ type: WISHLIST_OP_MESSAGE, op, id, bandId, itemType });
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
        if (Number.isInteger(message.rid) && OPS.includes(message.op) && isNumericId(message.id) && isNumericId(message.bandId)) {
          forwardWishlistRequest({ ...message, itemType: message.itemType === 't' ? 't' : 'a' });
        }
        break;
      case 'notice':
        if (message.kind === 'reload') showReloadNotice();
        else if (message.kind === 'newday') showNewDayNotice();
        else if (message.kind === 'news' && typeof message.key === 'string' && typeof message.title === 'string') showNewsNotice(message.key.slice(0, 200));
        break;
      case 'toast':
        if (typeof message.msg === 'string') showToast(message.msg.slice(0, MAX_TOAST_LENGTH));
        break;
      case 'close': // a click inside the page: the menu of the player bar closes too
        if (state.bar) state.bar.closeMenus();
        break;
      case 'now':
        // Updates are partial: the queue and the Liked list are only included when they changed, so keep the last ones. (The Liked list only until the
        // bar has drawn it: the bar counts the songs from there on, and it must have seen the list before the first song is added, to animate it.)
        state.lastNow = {
          ...message,
          queue: message.queue !== undefined ? message.queue : state.lastNow ? state.lastNow.queue : undefined,
          savedList: message.savedList !== undefined ? message.savedList : state.lastNow && !state.bar ? state.lastNow.savedList : undefined,
        };
        renderBar();
        break;
      default:
    }
  }
  window.addEventListener('message', handleFrameMessage);
  // The extension was reloaded or updated while the Bandcamp tab was open: this copy of the script is cut off from it. It takes the player bar away
  // and stays quiet (a reload of the tab brings the new version).
  window.addEventListener('unhandledrejection', (event) => {
    if (!/Extension context invalidated/i.test(String((event.reason && event.reason.message) || event.reason || ''))) return;
    event.preventDefault();
    showReloadNotice();   // (the page and the bar stay as they are: only the notice says that a reload is needed)
  });

  // ── Player bar ────────────────────────────────────────────────────────────────────────────────────────────────

  function ensureBar() {
    if (state.bar) return state.bar;
    state.bar = BCPlayer.create({
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
    showProfile();
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
    if (!(await isOwnPage(readPageData()))) { showProfile(); return; }
    const tab = document.createElement('li');
    tab.className = TAB_CLASS;
    tab.dataset.tab = 'dailyrecs';
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = 'daily recs';
    const badge = document.createElement('span');
    badge.className = 'dr-new-tag'; // the look of Bandcamp's "NEW" tag on the playlists tab; it goes after the name
    title.append(badge);
    tab.append(title);
    tabsContainer.appendChild(tab);
    state.tab = tab;
    state.tagEl = badge;
    updateTabTag();
    if (location.hash === HASH || takeReopenFlag()) openPanel(); else showProfile();
    watchForUpdate();
  }

  const REOPEN_KEY = 'dr-reopen';
  /** Reloads the page and, if the daily recs tab was open, brings it back open (the address may not keep #dailyrecs). */
  function reloadKeepingTab() {
    try { if (state.isOpen) sessionStorage.setItem(REOPEN_KEY, '1'); } catch { /* the reload still works */ }
    location.reload();
  }
  function takeReopenFlag() {
    try {
      const found = sessionStorage.getItem(REOPEN_KEY) === '1';
      sessionStorage.removeItem(REOPEN_KEY);
      return found;
    } catch { return false; }
  }

  let applyingUpdate = false;   // the Update button was clicked: the page reloads by itself, no notice is needed
  let reloadNeeded = false;     // the extension was updated under this tab: its notice replaces the others

  /**
   * There is news in this version: a line with a button for the What's new page and a close icon. Closing it, or opening the page, marks the
   * block as seen (it is not shown again until there is a new one) and takes the dot off the toolbar icon.
   */
  function showNewsNotice(key) {
    if (reloadNeeded) return;   // the page needs a reload first: the notice of news comes back with the new code, if it was not seen
    const markSeen = () => chrome.storage.local.set({ newsSeen: key }).then(() => chrome.storage.local.remove('whatsNew')).catch(() => {});
    DRNotice.show({
      id: 'news',
      text: 'Daily Recs was updated',
      action: {
        label: "See what's new",
        onClick: () => {
          markSeen();
          chrome.runtime.sendMessage({ type: 'open-whats-new' }).catch(() => {});
          DRNotice.hide('news');
        },
      },
      onClose: markSeen,
    });
  }

  /** The extension was updated or reloaded with this tab open: this copy of the script is cut off from it. Only a reload brings the new one. */
  function showReloadNotice() {
    if (applyingUpdate) return;
    reloadNeeded = true;
    DRNotice.hide('update');
    DRNotice.hide('news');   // (both say that Daily Recs was updated: only the one that asks for the reload stays)
    DRNotice.show({
      id: 'reload',
      text: 'Daily Recs was updated. Reload this page to keep using it.',
      closable: false,
      action: { label: 'Reload', onClick: reloadKeepingTab },
    });
  }

  // ── A new version is waiting ──────────────────────────────────────────────────────────────────────────────────

  /** The day changed with this tab open: the list stays as it is until the button asks for the new one. */
  function showNewDayNotice() {
    if (reloadNeeded) return;
    DRNotice.show({
      id: 'newday',
      text: 'A new day has started',
      action: { label: 'Get new recs', onClick: () => { DRNotice.hide('newday'); sendCommand('newDay'); } },
    });
  }

  /** The service worker keeps `updateAvailable` when the browser downloaded a new version: a notice with an Update button says so. */
  async function showUpdateNotice() {
    let stored = null;
    try { stored = (await chrome.storage.local.get('updateAvailable')).updateAvailable; } catch { return; }
    if (!stored || typeof stored.version !== 'string') { DRNotice.hide('update'); return; }
    DRNotice.show({
      id: 'update',
      text: `Daily Recs ${stored.version.slice(0, 20)} is ready to install.`,
      closable: false,
      action: {
        label: 'Update',
        onClick: () => {
          applyingUpdate = true;
          chrome.runtime.sendMessage({ type: 'apply-update' }).catch(() => {});
          setTimeout(reloadKeepingTab, 1500);   // the extension reloads itself; the page then comes back with the new version
        },
      },
    });
  }

  /**
   * The moment the extension is updated or reloaded, `chrome.runtime.id` is gone for this copy of the script: the notice appears then,
   * before anything fails (the page and the bar are left as they are).
   */
  function watchContext() {
    const alive = () => { try { return Boolean(chrome.runtime && chrome.runtime.id); } catch { return false; } };
    const timer = setInterval(() => {
      if (alive()) return;
      clearInterval(timer);
      showReloadNotice();
    }, 2000);
  }

  function watchForUpdate() {
    watchContext();
    showUpdateNotice();
    chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.updateAvailable) showUpdateNotice(); });
  }

  /** "daily recs new list": from the moment the list of the day is on screen until a song of it plays. A page left open past midnight keeps its old list: the notice says that a new day started, not the tag. */
  async function updateTabTag() {
    if (!state.tagEl) return;
    state.tagEl.textContent = (await hasNewList()) ? 'new list' : '';
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pickedDate) updateTabTag();
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
