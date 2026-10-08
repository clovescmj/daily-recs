// Everything that reads or writes the state goes through one queue, so a like clicked during a refresh is never lost.
// The service worker can be terminated at any time, so nothing here is kept only in memory in a way that matters:
// the queue and the in-flight map are just coordination for the current worker instance.
import { applyFeedback, extendList, refresh, refreshTags } from '../lib/recommender.js';
import { scanSources } from '../lib/scanner.js';
import { dequeueWishlistOp, emptyState, queueWishlistOp } from '../lib/state.js';
import { syncState } from '../lib/taste-sync.js';
import { loadStatus, markOpened, store, todaySummary } from './storage.js';

let chain = Promise.resolve();

/** Runs `task` after everything queued before it. A failing task doesn't block the ones after it. */
export function enqueue(task) {
  const result = chain.then(task);
  chain = result.catch(() => {});
  return result;
}

export const COUNT_MENU_ID = 'count';

/** Plain-language meaning of the number on the icon: today's albums you haven't opened yet. */
export function describeCount({ total, unopened }) {
  if (unopened) return `${unopened} new recommendation${unopened === 1 ? '' : 's'}`;
  return total ? "You've been through all of today's recommendations" : 'No recommendations yet';
}

/**
 * Shows how many of today's albums haven't been opened yet: the number on the icon, and what it means in the icon's
 * tooltip and in the first (disabled) item of its right-click menu.
 */
export async function updateBadge() {
  const summary = await todaySummary();
  const label = describeCount(summary);
  await chrome.action.setBadgeText({ text: summary.unopened ? String(summary.unopened) : '' });
  await chrome.action.setTitle({ title: `Daily Recs\n${label}` });
  try {
    await chrome.contextMenus.update(COUNT_MENU_ID, { title: label });
  } catch { /* the menu isn't created yet (first start): it is created with the right text on install */ }
}

/** Syncs taste with the user's Google account. Never throws: without sync (signed out, quota…) taste stays local. */
export async function syncNow() {
  try {
    const existing = await store.load();
    const state = existing || emptyState();
    const { changed } = await syncState(chrome.storage.sync, state);
    if (existing || changed) await store.save(state); // don't create an empty state just because sync ran first
  } catch (error) {
    console.warn('[daily-recs] sync failed:', error && error.message);
  }
}

// ---- Bandcamp asked us to slow down (HTTP 429): wait, then try again by itself ----

export const RETRY_ALARM = 'retry-after-rate-limit';
const ATTEMPT_KEY = 'retryAttempt';
const RETRY_STEP_MS = 5 * 60 * 1000;   // 5, 10, then 15 minutes
const MAX_RETRY_ATTEMPTS = 3;

/** True while we are waiting out a rate limit: nothing should hit Bandcamp again yet. */
async function isCoolingDown() {
  const status = await loadStatus();
  return Boolean(status && status.error === 'rate_limited' && status.retryAt > Date.now());
}

/** After a run: if it was rate limited, publish when we'll retry and set an alarm for it; otherwise forget the attempts. */
export async function planRetry() {
  const status = await loadStatus();
  if (!status || status.running || status.error !== 'rate_limited') {
    await chrome.storage.session.remove(ATTEMPT_KEY);
    return;
  }
  if (status.retryAt > Date.now()) return; // already planned
  const attempt = ((await chrome.storage.session.get(ATTEMPT_KEY))[ATTEMPT_KEY] || 0) + 1;
  if (attempt > MAX_RETRY_ATTEMPTS) { await chrome.storage.session.remove(ATTEMPT_KEY); return; } // give up; the user can retry later
  const retryAt = Date.now() + attempt * RETRY_STEP_MS;
  await chrome.storage.session.set({ [ATTEMPT_KEY]: attempt });
  await store.setStatus({ ...status, retryAt });
  await chrome.alarms.create(RETRY_ALARM, { when: retryAt });
}

/** The retry alarm went off: repeat what was rate limited. */
export async function retryAfterRateLimit() {
  const status = await loadStatus();
  if (!status || status.error !== 'rate_limited') return;
  const mode = ['surprise', 'tags'].includes(status.mode) ? status.mode : 'best';
  await runRefresh({ mode, tags: status.tags || [] });
}

const inFlight = new Map();

/** Identical refresh requests share one run; different ones (e.g. forced + surprise) run one after the other. */
export function runRefresh({ force = false, mode = 'best', tags = [] } = {}) {
  const key = `${force}:${mode}:${tags.join('+')}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const job = enqueue(async () => {
    if (await isCoolingDown()) return;
    await syncNow();
    if (mode === 'tags') await refreshTags({ fetch: (...args) => fetch(...args), store, tags, force });
    else await refresh({ fetch: (...args) => fetch(...args), store, force, mode });
    await planRetry();
    await updateBadge();
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** Background scan of the user's albums for genre tags: a few pages per call, never while a run is in progress or cooling down. */
export const runScan = () => enqueue(async () => {
  const status = await loadStatus();
  if ((status && status.running) || (await isCoolingDown())) return;
  const state = await store.load();
  if (!state || !state.owned) return;
  const result = await scanSources({ fetch: (...args) => fetch(...args), state });
  if (result.scanned || state.scanPausedUntil) await store.save(state);
});

/** One more album for the end of a list. Resolves with its id, or null. Never shown as progress: it happens in the background. */
export const runExtend = ({ view, tags }) => enqueue(async () => {
  if (await isCoolingDown()) return null;
  return extendList({ fetch: (...args) => fetch(...args), store, view, tags });
});

export const runFeedback = ({ id, kind, tags, index, track }) => enqueue(async () => {
  await applyFeedback({ fetch: (...args) => fetch(...args), store, id, kind, tags, index, track });
  await syncNow();
});

export const runWishlistQueue = (op) => enqueue(async () => {
  const state = await store.load();
  if (!state) return;
  queueWishlistOp(state, op);
  await store.save(state);
});

export const runWishlistDone = (id) => enqueue(async () => {
  const state = await store.load();
  if (!state) return;
  dequeueWishlistOp(state, id);
  await store.save(state);
});

export const runMarkOpened = (id) => enqueue(async () => {
  await markOpened(id);
  await updateBadge();
});
