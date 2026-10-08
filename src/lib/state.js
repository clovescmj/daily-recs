// Shape of the persisted state, its schema version, and migrations from older versions.
import { migrateTaste } from './taste-sync.js';
import { normalizeTasteTags } from './taste-profile.js';

export const SCHEMA_VERSION = 3;
export const DAILY_COUNT = 50;

export const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const emptyState = () => ({
  schemaVersion: SCHEMA_VERSION,
  pool: {},              // albumId -> candidate { id, title, artist, artistId, url, art, fans, via, srcs }
  sampled: {},           // source url -> timestamp of the last time its recommendations were read
  shown: [],             // album ids shown on previous days (they never repeat)
  shownArtists: [],      // artist ids shown on previous days (they don't come back with another album)
  shownToday: [],        // ...and shown today: they may appear again in another list of the same day
  shownArtistsToday: [],
  shownDate: '',         // the day shownToday refers to
  liked: [],             // derived from `votes` (albums the user gave a thumbs up)
  wishlisted: [],        // albums the user put in the Bandcamp wishlist from the extension (kept on this computer)
  dismissed: [],         // derived from `votes` (albums marked "don't show again")
  votes: {},             // albumId -> "<vote>.<time>" (see taste-sync.js)
  tasteBootstrapped: false, // true once a run has read enough of the library to learn the genre profile
  albumTags: {},         // hashed album url -> "tag|tag" for the user's albums that were read (see taste-profile.js)
  tagLabels: {},         // tag key -> readable name
  scanPausedUntil: 0,    // the background scan rests until this time (e.g. after Bandcamp asked to slow down)
  tasteTags: {},         // genre tag -> weight, built from the user's own albums (see taste-profile.js)
  sourceLikes: {},       // hashed source url -> likes that came from it
  sourceDislikes: {},    // hashed source url -> dislikes that came from it
  today: null,           // { date, ids } – best matches, built first
  tagLists: {},          // "metal+noise" -> { date, ids, tags: [keys] }: lists built around the user's own genres
  surprise: null,        // { date, ids } – built only when asked; the best list stays saved next to it
  owned: null,           // snapshot of the user's library (see loadLibrary)
  wishQueue: [],         // wishlist operations waiting for the profile tab: [{ op, id, bandId }]
  fanId: '',
  profileUrl: '',
});

/** Brings any previously saved state up to the current schema. Mutates and returns the state. */
export function migrateState(state) {
  migrateTaste(state);
  state.wishlisted ||= [...(state.liked || [])]; // before the two were separated, a like was also a wishlist entry
  normalizeTasteTags(state);
  if (state.owned && state.owned.count !== undefined) { // legacy names
    state.owned.collectionCount = state.owned.count;
    state.owned.wishlistCount = state.owned.wishCount || 0;
    delete state.owned.count; delete state.owned.wishCount; delete state.owned.name;
  }
  // Fields that no longer live in `state`: progress moved to its own storage key, the rest was unused.
  for (const legacy of ['status', 'wished', 'focus', 'opened', 'fanName', 'lastMode']) delete state[legacy];
  const defaults = emptyState();
  for (const [key, value] of Object.entries(defaults)) if (state[key] === undefined) state[key] = value;
  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

// ---- Wishlist operations that couldn't run right away (e.g. a failed removal) ----

/** Queues an operation. Opposite operations on the same album cancel each other out. */
export function queueWishlistOp(state, { op, id, bandId }) {
  state.wishQueue ||= [];
  const index = state.wishQueue.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    if (state.wishQueue[index].op !== op) state.wishQueue.splice(index, 1);
  } else {
    state.wishQueue.push({ op, id, bandId });
  }
  return state.wishQueue;
}

export function dequeueWishlistOp(state, id) {
  state.wishQueue = (state.wishQueue || []).filter((entry) => entry.id !== id);
  return state.wishQueue;
}

// ---- Several lists per day (best matches, surprise, one per set of genres) ----

/** Stable key for a set of genre tags: "metal+noise". */
export const tagListKey = (keys) => [...new Set(keys)].sort().join('+');

/** Lists built today: [{ kind, key, list }]. */
export function todaysLists(state, today = todayKey()) {
  const lists = [];
  if (state.today && state.today.date === today) lists.push({ kind: 'best', key: 'best', list: state.today });
  if (state.surprise && state.surprise.date === today) lists.push({ kind: 'surprise', key: 'surprise', list: state.surprise });
  for (const [key, list] of Object.entries(state.tagLists || {})) if (list.date === today) lists.push({ kind: 'tags', key, list });
  return lists;
}

/**
 * The list the user is looking at today: the one they picked ({ date, view, tags } saved when they chose), or, if that one
 * doesn't exist, any other list of today. Used for the numbers on the icon and on the tab.
 */
export function activeList(state, picked, today = todayKey()) {
  if (!state) return null;
  if (picked && picked.date === today) {
    const list = picked.view === 'surprise' ? state.surprise : picked.view === 'tags' ? (state.tagLists || {})[tagListKey(picked.tags || [])] : state.today;
    if (list && list.date === today) return list;
  }
  const [first] = todaysLists(state, today);
  return first ? first.list : null;
}

/** Album ids on any of today's lists (their cards need the candidate data kept in the pool). */
export const idsOfTodaysLists = (state, today) => todaysLists(state, today).flatMap(({ list }) => list.ids);

/**
 * What was shown on earlier days never comes back; what was shown today may appear in another list of the same day. When
 * the day changes, yesterday's "shown today" becomes "shown before".
 */
export function rollShownOver(state, today) {
  if (state.shownDate === today) return;
  state.shown.push(...(state.shownToday || []));
  state.shownArtists = [...new Set([...(state.shownArtists || []), ...(state.shownArtistsToday || [])])];
  state.shownToday = [];
  state.shownArtistsToday = [];
  state.shownDate = today;
  state.tagLists = Object.fromEntries(Object.entries(state.tagLists || {}).filter(([, list]) => list.date === today)); // old lists go
}
