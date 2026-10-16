// Storage adapter for the service worker. The recommender talks to this through the `store` interface
// (see recommender.js); the pages read the same keys directly.
import { LIKED_KEY, STATE_KEY, STATUS_KEY } from '../lib/storage-keys.js';
import { loadLiked, mirrorLiked } from '../lib/liked.js';
import { todayKey } from '../lib/state.js';

export const store = {
  /** The state, with the Liked Songs of their own key (the first time, the list kept in the state by an older version moves there). */
  async load() {
    const state = (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || null;
    if (!state) return null;
    const liked = await loadLiked(chrome.storage.local);
    if (liked) mirrorLiked(state, liked);
    else if (Array.isArray(state.saved)) await chrome.storage.local.set({ [LIKED_KEY]: state.saved });
    return state;
  },
  /** Saves the state, but never the Liked Songs: the list of their own key wins over the copy the state carries. */
  async save(state) {
    const liked = await loadLiked(chrome.storage.local);
    if (liked) mirrorLiked(state, liked);
    else await chrome.storage.local.set({ [LIKED_KEY]: Array.isArray(state.saved) ? state.saved : [] });
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
