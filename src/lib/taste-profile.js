import { normalizeTag } from './bandcamp.js';

// What the user's library says about their taste: how much each of their albums counts, and a weighted profile of the
// genre tags found on them. Pure functions over the persisted state.

// Buying and saving both show interest; saving is a little lower (many saved albums are never bought), and recent
// items say more about the current taste than old ones.
export const KIND_WEIGHT = Object.freeze({ collection: 1, wishlist: 0.85 });
export const LIKED_BONUS = 1.5;        // albums liked in the extension are the strongest signal
const RECENCY_FLOOR = 0.75;            // the oldest item still counts 75% as much as the newest
const MAX_TASTE_TAGS = 300;

/** Returns `weigh(url)`: how much a source album counts (1 = a recent purchase). Built once per run/ranking. */
export function createSourceWeigher(state) {
  const base = new Map();
  for (const source of (state.owned && state.owned.sources) || []) {
    const kindWeight = KIND_WEIGHT[source.kind] ?? 1;
    base.set(source.url, kindWeight * (RECENCY_FLOOR + (1 - RECENCY_FLOOR) * (source.recent ?? 1)));
  }
  const likedUrls = new Set((state.liked || []).map((id) => state.pool && state.pool[id] && state.pool[id].url).filter(Boolean));
  return (url) => (base.get(url) ?? 1) * (likedUrls.has(url) ? LIKED_BONUS : 1);
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
