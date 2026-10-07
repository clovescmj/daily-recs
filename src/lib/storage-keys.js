// Storage layout.
//   local   "state"   – long-lived data (library snapshot, candidates, taste, today's list)
//   session "status"  – progress of the current run (tiny, in memory only, cleared when the browser closes)
//   local   "opened"  – which of today's albums were opened (drives the toolbar badge)
//   sync    "taste:*" – likes/dislikes, see taste-sync.js
export const STATE_KEY = 'state';
export const STATUS_KEY = 'status';
export const OPENED_KEY = 'opened';

/** A run that has not reported progress for this long is considered dead (e.g. the service worker was terminated). */
export const STALE_STATUS_MS = 2 * 60 * 1000;

/** True when a status claims to be running but stopped reporting progress. */
export const isStatusStale = (status, now = Date.now()) => Boolean(status && status.running && now - (status.updatedAt || 0) > STALE_STATUS_MS);
