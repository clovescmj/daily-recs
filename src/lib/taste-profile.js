import { isBandcampUrl, normalizeTag } from './bandcamp.js';
import { hashSource } from './taste-sync.js';

// What the user's library says about their taste: how much each of their albums counts, and a weighted profile of the
// genre tags found on them. Pure functions over the persisted state.

// Buying and saving both show interest; saving is a little lower (many saved albums are never bought), and recent
// items say more about the current taste than old ones.
export const KIND_WEIGHT = Object.freeze({ collection: 1, wishlist: 0.85 });
export const LIKED_BONUS = 1.5;        // albums liked in the extension are the strongest signal
export const WISHLISTED_BONUS = 1.2;   // ...and so, a little less, are the ones the user put in the wishlist from there
const RECENCY_FLOOR = 0.75;            // the oldest item still counts 75% as much as the newest
const MAX_TASTE_TAGS = 300;

/** Returns `weigh(url)`: how much a source album counts (1 = a recent purchase). Built once per run/ranking. */
export function createSourceWeigher(state) {
  const base = new Map();
  for (const source of (state.owned && state.owned.sources) || []) {
    const kindWeight = KIND_WEIGHT[source.kind] ?? 1;
    base.set(source.url, kindWeight * (RECENCY_FLOOR + (1 - RECENCY_FLOOR) * (source.recent ?? 1)));
  }
  const urlsOf = (ids) => new Set((ids || []).map((id) => state.pool && state.pool[id] && state.pool[id].url).filter(Boolean));
  const likedUrls = urlsOf(state.liked);
  const wishlistedUrls = urlsOf(state.wishlisted);
  return (url) => (base.get(url) ?? 1) * (likedUrls.has(url) ? LIKED_BONUS : wishlistedUrls.has(url) ? WISHLISTED_BONUS : 1);
}

/** Merges spellings of the same tag that were stored before they were normalised ("e.b.m" + "ebm"). */
export function normalizeTasteTags(state) {
  const merged = {};
  for (const [tag, weight] of Object.entries(state.tasteTags || {})) {
    const key = normalizeTag(tag);
    merged[key] = Math.round(((merged[key] || 0) + weight) * 1000) / 1000;
  }
  state.tasteTags = merged;
}

/**
 * How much of the user's library has this tag, from 0 to 1 (the tag's weight over the number of albums read). Used to keep a
 * list in proportion to the user's taste: a genre that is 5% of their library should not be 25% of the list.
 */
export function tagShare(state, tag) {
  const weight = (state.tasteTags || {})[tag] || 0;
  const albumsRead = Math.max(30, Object.keys(state.sampled || {}).length * 0.9);
  return Math.min(1, weight / albumsRead);
}

/** Adds the tags of one source album to the profile (each source is counted once, when it is first read). */
export function addTasteTags(state, tags, weight) {
  if (!tags.length) return;
  const profile = (state.tasteTags ||= {});
  for (const tag of tags) profile[tag] = Math.round(((profile[tag] || 0) + weight) * 1000) / 1000;
  const entries = Object.entries(profile);
  if (entries.length > MAX_TASTE_TAGS) {
    state.tasteTags = Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_TASTE_TAGS));
  }
}

/**
 * How close an album's tags are to the user's taste: cosine similarity between the album (tags as 1/0) and the weighted
 * profile, from 0 to 1. Returns null when there is nothing to compare (no tags, or no profile yet).
 */
export function tagFit(state, rawTags) {
  const profile = state.tasteTags;
  if (!profile || !rawTags || !rawTags.length) return null;
  const tags = rawTags.map(normalizeTag);
  let norm = 0;
  for (const weight of Object.values(profile)) norm += weight * weight;
  if (!norm) return null;
  let dot = 0;
  for (const tag of tags) dot += profile[tag] || 0;
  return dot / (Math.sqrt(tags.length) * Math.sqrt(norm));
}

// ---------------------------------------------------------------------------------------------------------------------
// Which of the user's own albums have which tags (so a list can start from "my metal albums").
// state.albumTags: hashed album url -> "tag|tag|tag" ("" when the page has no tags). Only albums that were read are in it.
// state.tagLabels: tag key -> readable name, as artists write it ("post-punk" for the key "postpunk").
// ---------------------------------------------------------------------------------------------------------------------

/** Remembers the tags of one of the user's albums. `tags` is the result of parseTagLabels. */
export function recordAlbumTags(state, url, tags) {
  (state.albumTags ||= {})[hashSource(url)] = tags.map((tag) => tag.key).join('|');
  const labels = (state.tagLabels ||= {});
  for (const { key, label } of tags) {
    // prefer the plainest spelling ("ebm" over "e.b.m")
    if (!labels[key] || (label.length < labels[key].length && /^[a-z0-9 -]+$/.test(label))) labels[key] = label;
  }
}

export const tagsOfAlbum = (state, url) => {
  const stored = (state.albumTags || {})[hashSource(url)];
  return stored ? stored.split('|') : [];
};

/** The user's albums that can be read at all (bandcamp.com pages). */
const readableSources = (state) => ((state.owned && state.owned.sources) || []).filter((source) => isBandcampUrl(source.url));

/** How much of the library has been scanned for tags: { scanned, total }. */
export function scanProgress(state) {
  const sources = readableSources(state);
  const index = state.albumTags || {};
  return { scanned: sources.filter((source) => hashSource(source.url) in index).length, total: sources.length };
}

/** Albums whose tags are not known yet, in random order (a few are enough; they are read slowly). */
export function unscannedSources(state, count) {
  const index = state.albumTags || {};
  const pending = readableSources(state).filter((source) => !(hashSource(source.url) in index));
  for (let i = pending.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pending[i], pending[j]] = [pending[j], pending[i]]; }
  return pending.slice(0, count);
}

/** The genres found in the user's scanned albums: [{ key, label, count }], most common first. */
export function knownTags(state, minCount = 1) {
  const counts = {};
  for (const stored of Object.values(state.albumTags || {})) {
    if (stored) for (const key of stored.split('|')) counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= minCount)
    .map(([key, count]) => ({ key, label: (state.tagLabels || {})[key] || key, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Records what was learned from reading one of the user's albums: its tags, and (the first time that album is ever read) its
 * contribution to the genre profile. `weight` is how much the album counts (see createSourceWeigher).
 */
export function recordSourceRead(state, url, tags, weight) {
  const firstTime = !(state.sampled || {})[url] && !((hashSource(url)) in (state.albumTags || {}));
  recordAlbumTags(state, url, tags);
  if (firstTime) addTasteTags(state, tags.map((tag) => tag.key), weight);
}

// ---------------------------------------------------------------------------------------------------------------------
// Which tags are worth offering in the genre picker. Tags are free text, so besides genres there are formats, years, and the
// names of labels and artists. These stay in the taste profile (they do no harm there), they just aren't offered as genres.
// ---------------------------------------------------------------------------------------------------------------------

const NOT_GENRES = new Set([
  'cassette', 'cassettes', 'tape', 'tapes', 'vinyl', 'lp', 'ep', 'cd', 'cds', 'digital', 'single', 'singles', 'album', 'albums',
  'compilation', 'compilations', 'split', 'bandcamp', 'free', 'freedownload', 'limited', 'exclusive', 'preorder', 'new', 'newrelease',
  'newreleases', 'release', 'releases', 'record', 'records', 'label', 'music', 'sound', 'song', 'songs', 'band', 'artist', 'artists',
  'various', 'variousartists', 'va', '7inch', '10inch', '12inch', 'flexi', 'reissue', 'remaster', 'remastered',
]);
const MIN_ALBUMS = 2;              // a tag found on a single album of the user's isn't a genre of theirs
const MIN_NAME_LENGTH = 4;         // shorter tags would "match" inside too many names
const NAME_SHARE = 0.5;            // hide a tag when at least this share of its albums come from an account of that name
const PRIMARY_POSITIONS = 3;       // genres come first on a page...
const MIN_PRIMARY_SHARE = 0.25;    // ...so a tag that is almost never among the first ones isn't treated as a genre

const squash = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
const accountOf = (url) => (String(url).match(/^https:\/\/([a-z0-9-]+)\.bandcamp\.com/i) || [])[1] || '';

/** The genres to offer in the picker: knownTags without formats, years, label/artist names and tags that are never really a genre. */
export function selectableTags(state) {
  const sourceByHash = new Map(((state.owned && state.owned.sources) || []).map((source) => [hashSource(source.url), source]));
  const stats = {};   // tag -> { albums, primary, named }
  for (const [hash, stored] of Object.entries(state.albumTags || {})) {
    if (!stored) continue;
    const source = sourceByHash.get(hash);
    const names = source ? [squash(source.artist), squash(accountOf(source.url))].filter(Boolean) : [];
    stored.split('|').forEach((tag, position) => {
      const entry = (stats[tag] ||= { albums: 0, primary: 0, named: 0 });
      entry.albums++;
      if (position < PRIMARY_POSITIONS) entry.primary++;
      if (tag.length >= MIN_NAME_LENGTH && names.some((name) => name.includes(tag))) entry.named++;
    });
  }
  return knownTags(state, MIN_ALBUMS).filter(({ key }) => {
    const entry = stats[key];
    return !NOT_GENRES.has(key) && !/^(19|20)\d\d$/.test(key)
      && entry.primary / entry.albums >= MIN_PRIMARY_SHARE
      && !(entry.named >= 2 && entry.named / entry.albums >= NAME_SHARE);
  });
}
