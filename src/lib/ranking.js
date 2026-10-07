// Pure ranking and selection logic (no I/O). Everything here works on the persisted state.
import { hashSource } from './taste-sync.js';
import { createSourceWeigher, tagFit } from './taste-profile.js';

// ---------------------------------------------------------------------------------------------------------------------
// Ownership lookup: Sets are built once per `owned` snapshot instead of scanning arrays for every candidate.
// ---------------------------------------------------------------------------------------------------------------------
const ownedIndexes = new WeakMap();

function ownedIndex(owned) {
  let index = ownedIndexes.get(owned);
  if (!index) {
    index = { ids: new Set(owned.ids), bandIds: new Set(owned.bandIds), urls: new Set(owned.urls) };
    ownedIndexes.set(owned, index);
  }
  return index;
}

/** True if the user already has this album, any album by the same artist, or the same URL (collection + wishlist). */
export function isOwned(candidate, owned) {
  const index = ownedIndex(owned);
  return index.ids.has(candidate.id) || index.bandIds.has(candidate.artistId) || index.urls.has(candidate.url);
}

// ---------------------------------------------------------------------------------------------------------------------
// Taste thermometer: likes/dislikes become points on the *source* (the album of yours a suggestion came from).
// ---------------------------------------------------------------------------------------------------------------------
const POINTS_PER_SOURCE = 10;
const FANS_WEIGHT = 3;             // "fans in common" is Bandcamp's own signal: it counts about as much as one more source
const THERMOMETER_WEIGHT = 5;
const TAG_WEIGHT = 60;             // a perfect tag match is worth about six sources
const NO_OVERLAP_PENALTY = 0.3;    // share of TAG_WEIGHT lost by an album sharing no tag with the user's taste
const BOOSTED_SOURCE_SHARE = 0.3;
const REJECTED_SOURCE_NET = -2;
const MAX_SOURCES_PER_ARTIST = 2;  // an artist's albums recommend the same things: more than two add nothing

/** Net taste points of a source: likes that came from it minus dislikes that came from it. */
export const sourceNet = (state, sourceUrl) => {
  const key = hashSource(sourceUrl);
  return ((state.sourceLikes || {})[key] || 0) - ((state.sourceDislikes || {})[key] || 0);
};

/**
 * How well a candidate fits: how many of the user's albums point at it (each weighted by how much that album counts),
 * the fans they have in common, the thermometer, and how close its genre tags are to the user's taste.
 * Dislikes never touch tags: not liking one album says nothing about the genre.
 */
export function score(candidate, state, weigh = createSourceWeigher(state)) {
  let total = 0;
  for (const [url, fans] of Object.entries(candidate.srcs)) {
    total += weigh(url) * (POINTS_PER_SOURCE + FANS_WEIGHT * Math.log2(1 + fans)) + THERMOMETER_WEIGHT * sourceNet(state, url);
  }
  const fit = tagFit(state, candidate.tags);
  if (fit !== null) total += fit > 0 ? TAG_WEIGHT * fit : -TAG_WEIGHT * NO_OVERLAP_PENALTY;
  return total;
}

/** Sum of the thermometer over all sources of a candidate. Negative means "the user rejected where this came from". */
export const candidateNet = (candidate, state) => Object.keys(candidate.srcs).reduce((sum, url) => sum + sourceNet(state, url), 0);

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------------------------------------------------

/** Candidates that may still be shown, best first: not owned, not seen, not voted on, and from a new artist. */
export function rankedCandidates(state) {
  const weigh = createSourceWeigher(state);
  const seen = new Set([...state.shown, ...state.dismissed, ...(state.liked || [])]);
  const seenArtists = new Set(state.shownArtists || []);
  return Object.values(state.pool)
    .filter((c) => !seen.has(c.id) && !seenArtists.has(c.artistId) && !isOwned(c, state.owned))
    .map((candidate) => ({ candidate, points: score(candidate, state, weigh) }))
    .sort((a, b) => b.points - a.points)
    .map(({ candidate }) => candidate);
}

/** "Best matches": the top candidates, one per artist (completing with repeated artists only as a last resort). */
export function pickBest(state, count) {
  const ranked = rankedCandidates(state);
  const artists = new Set();
  const picks = [];
  for (const candidate of ranked) {
    if (artists.has(candidate.artistId)) continue;
    artists.add(candidate.artistId);
    picks.push(candidate.id);
    if (picks.length >= count) break;
  }
  for (const candidate of ranked) {
    if (picks.length >= count) break;
    if (!picks.includes(candidate.id)) picks.push(candidate.id);
  }
  return picks;
}

/**
 * "Surprise me": picks from deeper in the ranking (beyond what "Best matches" would show), skipping anything the
 * thermometer rejected. Marks the chosen candidates as surprises and returns their ids.
 */
export function pickSurprise(state, count) {
  const ranked = rankedCandidates(state);
  // Surprising is not random: it must share something with the user's taste, and not come from rejected sources.
  // Albums whose tags are unknown only fill in when there aren't enough known ones.
  const notRejected = (candidate) => candidateNet(candidate, state) >= 0;
  const fits = (candidate) => notRejected(candidate) && (tagFit(state, candidate.tags) ?? 0) > 0;
  const unknown = (candidate) => notRejected(candidate) && tagFit(state, candidate.tags) === null;
  const hasProfile = Object.keys(state.tasteTags || {}).length > 0;
  const acceptable = hasProfile ? fits : notRejected;
  const deeper = shuffle(ranked.slice(count).filter(acceptable));
  const top = shuffle(ranked.slice(0, count).filter(acceptable)); // fallback when the deeper part is small
  const fillers = hasProfile ? shuffle(ranked.filter(unknown)) : [];
  const artists = new Set();
  const picks = [];
  for (const candidate of [...deeper, ...top, ...fillers]) {
    if (artists.has(candidate.artistId)) continue;
    artists.add(candidate.artistId);
    picks.push(candidate.id);
    candidate.surprise = true;
    if (picks.length >= count) break;
  }
  return picks;
}

/** Random order where heavier items tend to come first (weighted sampling without replacement). */
function weightedShuffle(items, weightOf) {
  return items
    .map((item) => ({ item, key: Math.random() ** (1 / Math.max(weightOf(item), 0.01)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

/** Keeps at most `limit` albums per artist, preserving order. */
function limitPerArtist(sources, limit) {
  const counts = new Map();
  return sources.filter((source) => {
    const n = (counts.get(source.artist) || 0) + 1;
    counts.set(source.artist, n);
    return n <= limit;
  });
}

/**
 * Chooses which of the user's albums to read next (random, guided by the thermometer and by how much each album counts):
 *  1) albums the user liked become sources (their recommendations turn into suggestions);
 *  2) up to 30% of the slots go to sources that already produced likes;
 *  3) sources that produced a lot of dislikes are skipped;
 *  4) the rest: never-read sources first, then the ones read before; recent purchases and saves are more likely;
 *  5) no more than two albums per artist.
 */
export function pickSources(state, count) {
  const weigh = createSourceWeigher(state);
  const likedAlbums = (state.liked || [])
    .map((id) => state.pool[id]).filter(Boolean)
    .map((album) => ({ url: album.url, title: album.title, artist: album.artist }))
    .filter((source) => !state.sampled[source.url]);
  const eligible = state.owned.sources.filter((source) => sourceNet(state, source.url) > REJECTED_SOURCE_NET);
  const boosted = weightedShuffle(eligible.filter((source) => sourceNet(state, source.url) > 0), (s) => weigh(s.url))
    .slice(0, Math.ceil(count * BOOSTED_SOURCE_SHARE));
  const boostedUrls = new Set(boosted.map((source) => source.url));
  const rest = eligible.filter((source) => !boostedUrls.has(source.url));
  const neverRead = weightedShuffle(rest.filter((source) => !state.sampled[source.url]), (s) => weigh(s.url));
  const readBefore = weightedShuffle(rest.filter((source) => state.sampled[source.url]), (s) => weigh(s.url));
  return limitPerArtist([...likedAlbums, ...boosted, ...neverRead, ...readBefore], MAX_SOURCES_PER_ARTIST).slice(0, count);
}

/** Remembers that these albums (and their artists) were shown, so they never come back. */
export function markShown(state, ids) {
  state.shown.push(...ids);
  state.shownArtists = [...new Set([...(state.shownArtists || []), ...ids.map((id) => state.pool[id].artistId)])];
}
