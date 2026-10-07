// Reading from storage and talking to the service worker.
import { STATE_KEY, STATUS_KEY, isStatusStale } from '../../lib/storage-keys.js';

export const send = (message) => chrome.runtime.sendMessage(message);

export async function loadState() {
  return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || null;
}

export async function loadStatus() {
  const status = (await chrome.storage.session.get(STATUS_KEY))[STATUS_KEY] || null;
  // A run that stopped reporting (worker killed) must not keep the page in "loading" forever.
  return isStatusStale(status) ? { ...status, running: false } : status;
}

/** Calls `onChange` whenever the stored state or the run status changes. */
export function watchStorage(onChange) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === 'local' && changes[STATE_KEY]) || (area === 'session' && changes[STATUS_KEY])) onChange();
  });
}
