// Reading from storage and talking to the service worker.
import { PICKED_KEY, STATE_KEY, STATUS_KEY, isStatusStale } from '../../lib/storage-keys.js';
import { todayKey } from '../../lib/state.js';

export const send = (message) => chrome.runtime.sendMessage(message);

export async function loadState() {
  return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || null;
}

export async function loadStatus() {
  const status = (await chrome.storage.session.get(STATUS_KEY))[STATUS_KEY] || null;
  // A run that stopped reporting (worker killed) must not keep the page in "loading" forever.
  return isStatusStale(status) ? { ...status, running: false } : status;
}

/** True when the user has already chosen what to hear today (so the opening screen is skipped). */
export async function pickedToday() {
  return (await chrome.storage.local.get(PICKED_KEY))[PICKED_KEY] === todayKey();
}
export const markPickedToday = () => chrome.storage.local.set({ [PICKED_KEY]: todayKey() });

/** Calls `onChange` whenever the stored state or the run status changes. */
export function watchStorage(onChange) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === 'local' && changes[STATE_KEY]) || (area === 'session' && changes[STATUS_KEY])) onChange();
  });
}
