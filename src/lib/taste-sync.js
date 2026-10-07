// Taste sync: likes, dislikes and the per-source "thermometer", shared across devices through the user's Google
// account (chrome.storage.sync).
//
// Chrome's limits: ~100 KB in total, 8 KB per item, 120 writes/min. So:
//  - only what matters goes up: votes (with a timestamp) and per-source scores, using short hashed keys;
//  - the document is chunked into ~6.5 KB items (taste:0, taste:1, …) plus a taste:meta item;
//  - over budget, the weakest scores are dropped first, then old tombstones. Votes themselves are never dropped.
// Conflicts: per album the most recent timestamp wins (last-write-wins). Per-source scores take the larger value.
// `area` is injectable ({ get, set, remove }) so this can be tested without Chrome.
//
// Local state fields used here: `votes` (albumId -> "<vote>.<time>"), `sourceLikes`, `sourceDislikes`,
// and the derived lists `liked` and `dismissed`.

const PREFIX = 'taste:';
const CHUNK_CHARS = 6500;       // per item; Chrome allows 8192 bytes per item, key included
const BUDGET_BYTES = 92_000;    // real stored size (see storedSize); the total quota is 102_400
const TOMBSTONE_DAYS = 90;      // how long a removed like / undone dislike is remembered
const DOC_VERSION = 1;

/** Vote kinds stored per album. */
export const VOTE = Object.freeze({
  LIKE: 'l',
  UNLIKE: 'u',        // tombstone: a like that was removed
  DISLIKE: 'd',
  UNDISLIKE: 'n',     // tombstone: a dislike that was undone (back to neutral)
});

const isTombstone = (vote) => vote === VOTE.UNLIKE || vote === VOTE.UNDISLIKE;

/** Short, stable hash (FNV-1a) so source URLs don't have to be stored in full. */
export const hashSource = (url) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

const nowBase36 = () => Math.floor(Date.now() / 1000).toString(36);
const parseVote = (value) => {
  const [vote, time] = String(value).split('.');
  return { vote, time: parseInt(time || '0', 36) };
};

/** Records a local vote for an album. */
export function recordVote(state, albumId, vote) {
  state.votes ||= {};
  state.votes[albumId] = `${vote}.${nowBase36()}`;
}

/** Brings state from older versions up to date (vote timestamps, hashed source keys, renamed fields). */
export function migrateTaste(state) {
  if (state.tasteTs) { state.votes = { ...state.tasteTs, ...(state.votes || {}) }; delete state.tasteTs; }
  if (state.likedSrc) { state.sourceLikes = { ...state.likedSrc, ...(state.sourceLikes || {}) }; delete state.likedSrc; }
  if (state.dislikedSrc) { state.sourceDislikes = { ...state.dislikedSrc, ...(state.sourceDislikes || {}) }; delete state.dislikedSrc; }
  state.votes ||= {};
  for (const id of state.liked || []) if (!state.votes[id]) recordVote(state, id, VOTE.LIKE);
  for (const id of state.dismissed || []) if (!state.votes[id]) recordVote(state, id, VOTE.DISLIKE);
  for (const key of ['sourceLikes', 'sourceDislikes']) {
    const scores = (state[key] ||= {});
    for (const k of Object.keys(scores)) {
      if (/[/:.]/.test(k)) { const hashed = hashSource(k); scores[hashed] = (scores[hashed] || 0) + scores[k]; delete scores[k]; }
    }
  }
}

/** Rebuilds `liked` and `dismissed` from the votes (the votes are the source of truth). */
export function rebuildVoteLists(state) {
  const liked = [];
  const dismissed = [];
  for (const [id, value] of Object.entries(state.votes || {})) {
    const { vote } = parseVote(value);
    if (vote === VOTE.LIKE) liked.push(id);
    else if (vote === VOTE.DISLIKE) dismissed.push(id);
  }
  state.liked = liked;
  state.dismissed = dismissed;
}

/** Size Chrome will charge for this document: values are measured with their JSON quotes escaped, and every chunk has its own key. */
function storedSize(doc) {
  const text = JSON.stringify(doc);
  const quotes = (text.match(/"/g) || []).length;
  const chunks = Math.ceil(text.length / CHUNK_CHARS);
  return text.length + quotes + chunks * 16 + 64;
}

/** Drops the weakest scores, then the oldest tombstones, until the document fits. Votes are never dropped. */
function trimToBudget(doc) {
  if (storedSize(doc) <= BUDGET_BYTES) return;
  const weakest = [
    ...Object.entries(doc.ls).map(([key, score]) => ['ls', key, score]),
    ...Object.entries(doc.ds).map(([key, score]) => ['ds', key, score]),
  ].sort((a, b) => a[2] - b[2]);
  // Estimate how many entries must go (per entry: key + value + 4 JSON characters + 2 escaped quotes), then verify.
  let excess = storedSize(doc) - BUDGET_BYTES;
  let drop = 0;
  while (drop < weakest.length && excess > 0) {
    const [, key, score] = weakest[drop++];
    excess -= key.length + String(score).length + 6;
  }
  for (let i = 0; i < drop; i++) delete doc[weakest[i][0]][weakest[i][1]];
  for (let i = drop; i < weakest.length && storedSize(doc) > BUDGET_BYTES; i++) delete doc[weakest[i][0]][weakest[i][1]];
  if (storedSize(doc) <= BUDGET_BYTES) return;
  const tombstones = Object.entries(doc.m)
    .filter(([, value]) => isTombstone(parseVote(value).vote))
    .sort((a, b) => parseVote(a[1]).time - parseVote(b[1]).time);
  for (const [id] of tombstones) {
    if (storedSize(doc) <= BUDGET_BYTES) break;
    delete doc.m[id];
  }
}

/** The document that goes to the cloud. */
export function buildDoc(state) {
  const cutoff = Date.now() / 1000 - TOMBSTONE_DAYS * 86400;
  const votes = {};
  for (const [id, value] of Object.entries(state.votes || {})) {
    const { vote, time } = parseVote(value);
    if (isTombstone(vote) && time < cutoff) continue; // old tombstone
    votes[id] = value;
  }
  const doc = { v: DOC_VERSION, m: votes, ls: { ...(state.sourceLikes || {}) }, ds: { ...(state.sourceDislikes || {}) } };
  trimToBudget(doc);
  return doc;
}

/** Merges a remote document into local state. Returns true if anything changed locally. */
export function mergeRemote(state, remote) {
  if (!remote || remote.v !== DOC_VERSION) return false;
  migrateTaste(state);
  let changed = false;
  for (const [id, value] of Object.entries(remote.m || {})) {
    const local = state.votes[id];
    if (!local || parseVote(value).time > parseVote(local).time) { state.votes[id] = value; changed = true; }
  }
  for (const [remoteKey, localKey] of [['ls', 'sourceLikes'], ['ds', 'sourceDislikes']]) {
    state[localKey] ||= {};
    for (const [key, score] of Object.entries(remote[remoteKey] || {})) {
      if ((state[localKey][key] || 0) < score) { state[localKey][key] = score; changed = true; }
    }
  }
  rebuildVoteLists(state);
  return changed;
}

export async function pull(area) {
  const meta = (await area.get(`${PREFIX}meta`))[`${PREFIX}meta`];
  if (!meta || !meta.n) return null;
  const keys = Array.from({ length: meta.n }, (_, i) => PREFIX + i);
  const stored = await area.get(keys);
  const text = keys.map((key) => stored[key] || '').join('');
  try { return JSON.parse(text); } catch { return null; } // incomplete chunks: ignore
}

export async function push(area, state) {
  const text = JSON.stringify(buildDoc(state));
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_CHARS) chunks.push(text.slice(i, i + CHUNK_CHARS));
  const previous = (await area.get(`${PREFIX}meta`))[`${PREFIX}meta`];
  const items = { [`${PREFIX}meta`]: { v: DOC_VERSION, n: chunks.length, t: Date.now() } };
  chunks.forEach((chunk, i) => { items[PREFIX + i] = chunk; });
  await area.set(items);
  if (previous && previous.n > chunks.length) {
    await area.remove(Array.from({ length: previous.n - chunks.length }, (_, i) => PREFIX + (chunks.length + i)));
  }
  return { bytes: text.length, items: chunks.length };
}

/** Full cycle: pull, merge and, if local has something the cloud doesn't, push. Returns { changed, pushed }. */
export async function syncState(area, state) {
  migrateTaste(state);
  const remote = await pull(area);
  const changed = mergeRemote(state, remote);
  const upToDate = remote && JSON.stringify(remote) === JSON.stringify(buildDoc(state));
  const pushed = upToDate ? null : await push(area, state);
  return { changed, pushed };
}

/** Summary for the About page. */
export async function summary(area) {
  const meta = (await area.get(`${PREFIX}meta`))[`${PREFIX}meta`];
  const doc = await pull(area);
  if (!doc) return null;
  const votes = Object.values(doc.m).map((value) => parseVote(value).vote);
  return {
    likes: votes.filter((vote) => vote === VOTE.LIKE).length,
    dislikes: votes.filter((vote) => vote === VOTE.DISLIKE).length,
    updatedAt: meta ? meta.t : null,
  };
}
