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
export function tagFit(state, tags) {
  const profile = state.tasteTags;
  if (!profile || !tags || !tags.length) return null;
  let norm = 0;
  for (const weight of Object.values(profile)) norm += weight * weight;
  if (!norm) return null;
  let dot = 0;
  for (const tag of tags) dot += profile[tag] || 0;
  return dot / (Math.sqrt(tags.length) * Math.sqrt(norm));
}
