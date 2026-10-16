// Storage layout.
//   local   "state"   – long-lived data (library snapshot, candidates, taste, today's list)
//   session "status"  – progress of the current run (tiny, in memory only, cleared when the browser closes)
//   local   "likedSongs" – the Liked Songs list, apart from "state" so that nothing that rebuilds or resets the state can touch it (see liked.js)
//   local   "opened"  – which of today's albums were opened (drives the toolbar badge)
//   sync    "taste:*" – likes/dislikes, see taste-sync.js
export const STATE_KEY = 'state';
export const STATUS_KEY = 'status';
export const OPENED_KEY = 'opened';
export const LIKED_KEY = 'likedSongs';
export const DECISIONS_KEY = 'decisions';   // what was hidden, wishlisted or liked, and why (see decisions.js)
export const UPDATE_KEY = 'updateAvailable';   // { version, at }: a new version was downloaded and waits to be loaded (the notice with the Update button)
export const NEWS_SEEN_KEY = 'newsSeen';       // the title of the last block of What's new that the user closed in the notice
export const WHATS_NEW_KEY = 'whatsNew';   // { version, at }: a major update was installed and its news were not opened yet (a dot on the toolbar icon)
export const PICKED_KEY = 'pickedDate';   // the day the user last chose what to hear (the opening screen shows once a day)

/** A run that has not reported progress for this long is considered dead (e.g. the service worker was terminated). */
export const STALE_STATUS_MS = 2 * 60 * 1000;

/** True when a status claims to be running but stopped reporting progress. */
export const isStatusStale = (status, now = Date.now()) => Boolean(status && status.running && now - (status.updatedAt || 0) > STALE_STATUS_MS);
