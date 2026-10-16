// Shape of the persisted state, its schema version, and migrations from older versions.
import { migrateTaste } from './taste-sync.js';
import { normalizeTasteTags, splitMergedTags } from './taste-profile.js';

export const SCHEMA_VERSION = 3;
export const DAILY_COUNT = 50;

/** Milliseconds until the next local midnight (when "today" becomes another day). */
export const msUntilTomorrow = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();

export const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const emptyState = () => ({
  schemaVersion: SCHEMA_VERSION,
  pool: {},              // albumId -> candidate { id, title, artist, artistId, url, art, fans, via, srcs }
  sampled: {},           // source url -> timestamp of the last time its recommendations were read
  shown: [],             // album ids played on previous days (they never repeat; albums that were shown but not played may come back)
  shownArtists: [],      // artist ids played on previous days (they don't come back with another album)
  shownToday: [],        // ...and shown today: they may appear again in another list of the same day
  shownArtistsToday: [],
  playedToday: [],       // the albums of the day that were played (a song went on for a few seconds): only these are kept out of the next days
  playedArtistsToday: [],
  shownDate: '',         // the day shownToday and playedToday refer to
  liked: [],             // derived from `votes` (albums the user gave a thumbs up)
  tagCache: {},          // albumId -> { t: "tag|tag", at: ms }: the genre tags of candidates already read (they don't change, so they are not read twice)
  scoped: {},            // albumId -> { keys, artistId, near }: albums hidden from a genre list, hidden again only in lists of those genres
  avoid: {},             // albumId -> { artistId, near: [ids] }: albums hidden with "don't show music like this", and the albums Bandcamp pairs with them
  saved: [],             // the "Liked" list, newest last: tracks as { id (album), i (track number), title }. Their albums feed the search like the library does (kept on this computer)
  wishlisted: [],        // albums the user put in the Bandcamp wishlist from the extension (kept on this computer)
  wishlistedSongs: {},   // albumId -> id of the song that was put in the wishlist (the heart of a card is for one song)
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
  state.avoid ||= {};
  state.scoped ||= {};
  delete state.focusDislikes;
  state.tagCache ||= {};
  state.saved ||= [];
  state.wishlisted ||= [...(state.liked || [])]; // before the two were separated, a like was also a wishlist entry
  state.wishlistedSongs ||= {};
  normalizeTasteTags(state);
  splitMergedTags(state);
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

// ---- The wishlist the extension remembers ----

/**
 * Brings the record of the albums wishlisted from here in line with the real wishlist on Bandcamp, once the library has been read:
 *  - an album of the pool that is in the Bandcamp wishlist counts as wishlisted (Bandcamp took the add, but did not confirm it in time);
 *  - an album that is no longer in the wishlist (or in the library) does not.
 * Albums the pool does not know are left alone. Returns true when the record changed.
 */
export function reconcileWishlist(state) {
  const owned = state && state.owned;
  if (!owned || !Array.isArray(owned.sources)) return false;
  const stripQuery = (url) => String(url || '').split('?')[0];
  const inWishlist = new Set(owned.sources.filter((source) => source.kind === 'wishlist').map((source) => source.url));
  const inLibrary = new Set((owned.ids || []).map(String));
  const pool = state.pool || {};
  const before = state.wishlisted || [];
  const songs = state.wishlistedSongs || {};
  // (an album is wishlisted too when its song is: the library then lists the song, with the page of the song)
  const kept = before.filter((id) => !pool[id] || inLibrary.has(String(id)) || inLibrary.has(String(songs[id] || '')) || inWishlist.has(stripQuery(pool[id].url)));
  const added = Object.keys(pool).filter((id) => !kept.includes(id) && inWishlist.has(stripQuery(pool[id].url)));
  const next = [...kept, ...added];
  const changed = next.length !== before.length || next.some((id, i) => id !== before[i]);
  if (changed) state.wishlisted = next;
  return changed;
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

/** True when the album must not show in `list`: hidden everywhere, or hidden from a genre list that shares a genre with this one. */
export function hiddenIn(state, id, list) {
  if ((state.dismissed || []).includes(id)) return true;
  const entry = (state.scoped || {})[id];
  return Boolean(entry && list && list.tags && entry.keys.some((key) => list.tags.includes(key)));
}

/** Album ids on any of today's lists (their cards need the candidate data kept in the pool). */
export const idsOfTodaysLists = (state, today) => todaysLists(state, today).flatMap(({ list }) => list.ids);

/**
 * What was played on earlier days never comes back (nor do the artists); what was only shown, and not played, may come back.
 * What was shown today may appear in another list of the same day. When the day changes, yesterday's "played today" becomes "played before".
 */
export function rollShownOver(state, today) {
  if (state.shownDate === today) return;
  state.shown = [...new Set([...state.shown, ...(state.playedToday || [])])];
  state.shownArtists = [...new Set([...(state.shownArtists || []), ...(state.playedArtistsToday || [])])];
  state.shownToday = [];
  state.shownArtistsToday = [];
  state.playedToday = [];
  state.playedArtistsToday = [];
  state.shownDate = today;
  state.tagLists = Object.fromEntries(Object.entries(state.tagLists || {}).filter(([, list]) => list.date === today)); // old lists go
}

/** A song of this album went on for a few seconds: from tomorrow on the album (and its artist) is not shown again. Returns true when it was new. */
export function markPlayed(state, id) {
  const album = state.pool[id];
  if (!album || (state.playedToday || []).includes(id)) return false;
  state.playedToday = [...(state.playedToday || []), id];
  if (album.artistId) state.playedArtistsToday = [...new Set([...(state.playedArtistsToday || []), album.artistId])];
  return true;
}
