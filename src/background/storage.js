// Storage adapter for the service worker. The recommender talks to this through the `store` interface
// (see recommender.js); the pages read the same keys directly.
import { OPENED_KEY, PICKED_KEY, STATE_KEY, STATUS_KEY } from '../lib/storage-keys.js';
import { activeList, todayKey } from '../lib/state.js';

export const store = {
  async load() {
    return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || null;
  },
  save(state) {
    return chrome.storage.local.set({ [STATE_KEY]: state });
  },
  /** Progress lives in session storage: tiny, frequent, in memory, and gone when the browser closes. */
  setStatus(status) {
    return chrome.storage.session.set({ [STATUS_KEY]: { ...status, updatedAt: Date.now() } });
  },
};

export async function loadStatus() {
  return (await chrome.storage.session.get(STATUS_KEY))[STATUS_KEY] || null;
}

/**
 * The service worker can be terminated in the middle of a run, which would leave `running: true` behind forever.
 * Called when the worker starts (before any work is queued): a run found "in progress" at that point is dead.
 */
export async function clearStaleStatus() {
  const status = await loadStatus();
  if (status && status.running) await chrome.storage.session.set({ [STATUS_KEY]: { running: false, updatedAt: Date.now() } });
}

// ---- "opened" albums: drives the toolbar badge without touching the large state ----

async function loadOpened() {
  const opened = (await chrome.storage.local.get(OPENED_KEY))[OPENED_KEY];
  return opened && opened.date === todayKey() ? opened : { date: todayKey(), ids: [] };
}

export async function markOpened(id) {
  const opened = await loadOpened();
  if (!opened.ids.includes(id)) {
    opened.ids.push(id);
    await chrome.storage.local.set({ [OPENED_KEY]: opened });
  }
}

/** The albums of the list being used today: how many there are, and how many haven't been opened yet (nor hidden). */
export async function todaySummary() {
  const [state, picked] = [await store.load(), (await chrome.storage.local.get(PICKED_KEY))[PICKED_KEY]];
  const list = activeList(state, picked);
  if (!list) return { total: 0, unopened: 0 };
  const gone = new Set([...(state.dismissed || []), ...(await loadOpened()).ids]);
  return { total: list.ids.length, unopened: list.ids.filter((id) => !gone.has(id)).length };
}
