// Background scan: reads a few of the user's albums at a time, only to learn their genre tags. It is slow on purpose: a handful
// of pages every half hour adds up to the whole library in a couple of weeks without ever looking like a burst of requests.
import { HttpError, RateLimitedError, fetchText, parseTagLabels, sleep } from './bandcamp.js';
import { createSourceWeigher, recordSourceRead, scanProgress, unscannedSources } from './taste-profile.js';

export const SCAN_BATCH = 8;
const PAUSE_AFTER_RATE_LIMIT_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;
const POLITE_DELAY_MS = 1200;

const politePause = (ms) => sleep(ms ? ms + Math.random() * ms * 0.5 : 0);

/**
 * Scans up to `count` albums that have no tags recorded yet. Mutates `state`; the caller saves it.
 * Returns { read, paused, progress }: how many albums were read now, whether the scan is resting, and { scanned, total }.
 */
export async function scanSources({ fetch: fetchFn, state, count = SCAN_BATCH, now = Date.now(), tuning = {}, onProgress = () => {} }) {
  if (now < (state.scanPausedUntil || 0) || !state.owned) return { read: 0, paused: true, progress: scanProgress(state) };
  const delayMs = tuning.delayMs ?? POLITE_DELAY_MS;
  const options = { baseDelayMs: tuning.retryDelayMs };
  const weigh = createSourceWeigher(state);
  let read = 0;
  let failures = 0;
  for (const source of unscannedSources(state, count)) {
    try {
      const tags = parseTagLabels(await fetchText(fetchFn, source.url, options));
      recordSourceRead(state, source.url, tags, weigh(source.url));
      read++;
      failures = 0;
    } catch (error) {
      if (error instanceof RateLimitedError) { state.scanPausedUntil = now + PAUSE_AFTER_RATE_LIMIT_MS; break; }
      if (error instanceof HttpError && error.status < 500) { recordSourceRead(state, source.url, [], 0); continue; } // gone: don't retry forever
      if (++failures >= MAX_CONSECUTIVE_FAILURES) break;
    }
    onProgress(read, count);
    await politePause(delayMs);
  }
  return { read, paused: false, progress: scanProgress(state) };
}
