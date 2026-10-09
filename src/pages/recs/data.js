// Reading from storage and talking to the service worker.
import { LIKED_KEY, PICKED_KEY, STATE_KEY, STATUS_KEY, isStatusStale } from '../../lib/storage-keys.js';
import { changeLiked, mirrorLiked } from '../../lib/liked.js';
import { todayKey } from '../../lib/state.js';

export const send = (message) => chrome.runtime.sendMessage(message);

export async function loadState() {
  const stored = await chrome.storage.local.get([STATE_KEY, LIKED_KEY]);
  return mirrorLiked(stored[STATE_KEY] || null, stored[LIKED_KEY]);   // the Liked Songs come from their own key
}

/** Adds or removes songs of the Liked Songs and writes them at once: it does not wait for the service worker, which may be busy with a run. */
export const updateLiked = (songs, on) => changeLiked(chrome.storage.local, songs, on, async () => ((await loadState()) || {}).saved || []);

export async function loadStatus() {
  const status = (await chrome.storage.session.get(STATUS_KEY))[STATUS_KEY] || null;
  // A run that stopped reporting (worker killed) must not keep the page in "loading" forever.
  return isStatusStale(status) ? { ...status, running: false } : status;
}

/** What the user chose today ({ view, tags }), or null when they haven't chosen yet (then the opening screen shows). */
export async function pickedToday() {
  const picked = (await chrome.storage.local.get(PICKED_KEY))[PICKED_KEY];
  return picked && picked.date === todayKey() ? { view: picked.view, tags: picked.tags || [] } : null;
}
export const savePicked = (view, tags = []) => chrome.storage.local.set({ [PICKED_KEY]: { date: todayKey(), view, tags } });

/** Calls `onChange` whenever the stored state or the run status changes. */
export function watchStorage(onChange) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === 'local' && (changes[STATE_KEY] || changes[LIKED_KEY])) || (area === 'session' && changes[STATUS_KEY])) onChange();
  });
}
