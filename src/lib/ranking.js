// Pure ranking and selection logic (no I/O). Everything here works on the persisted state.
import { hashSource } from './taste-sync.js';
import { isBandcampUrl, normalizeTag } from './bandcamp.js';
import { createSourceWeigher, tagFit, tagShare } from './taste-profile.js';

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
const FOCUS_PRIMARY_TAGS = 4;     // in a genre list the chosen genre must be among an album's first four tags
const PRIMARY_TAGS = 4;            // an album's first tags say what genre it is; later ones are incidental
const TAG_CAP_SLACK = 1.5;         // a genre may take up to 1.5x its share of the user's library in a list
const MIN_TAG_CAP = 2;
const BROAD_TAG_SHARE = 0.4;       // tags this common ("electronic") are not limited: they say little and don't distort a list
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
export function rankedCandidates(state, exclude = {}) {
  const weigh = createSourceWeigher(state);
  // `exclude` ({ ids, artists }): albums already in the list being extended, so the new one is really new there
  const seen = new Set([...state.shown, ...state.dismissed, ...(state.liked || []), ...(state.wishlisted || []), ...(exclude.ids || [])]);
  const seenArtists = new Set([...(state.shownArtists || []), ...(exclude.artists || [])]);
  // "Don't show music like this": the artist of a hidden album, and the albums Bandcamp pairs with it, never come back
  const avoided = new Set();
  for (const entry of Object.values(state.avoid || {})) {
    if (entry.artistId) seenArtists.add(entry.artistId);
    for (const id of entry.near) avoided.add(id);
  }
  return Object.values(state.pool)
    .filter((c) => !seen.has(c.id) && !avoided.has(c.id) && !seenArtists.has(c.artistId) && !isOwned(c, state.owned))
    .map((candidate) => ({ candidate, points: score(candidate, state, weigh) }))
    .sort((a, b) => b.points - a.points)
    .map(({ candidate }) => candidate);
}

/**
 * Keeps a list in proportion to the user's taste. Recommendations from Bandcamp tend to pile up in a few popular
 * neighbourhoods (say, darkwave next to post-punk and EBM), so without a limit one of them can take a quarter of the
 * list although it is a small part of the user's library. A genre may appear in at most `slack` times its share of the
 * library (and at least MIN_TAG_CAP albums); only an album's first few tags count, and very common tags are not limited.
 */
function createTagLimiter(state, count) {
  const used = new Map();
  const primary = (candidate) => (candidate.tags || []).slice(0, PRIMARY_TAGS).map(normalizeTag);
  const cap = (tag) => Math.max(MIN_TAG_CAP, Math.ceil(count * tagShare(state, tag) * TAG_CAP_SLACK));
  return {
    allows: (candidate) => primary(candidate).every((tag) => tagShare(state, tag) >= BROAD_TAG_SHARE || (used.get(tag) || 0) < cap(tag)),
    take: (candidate) => primary(candidate).forEach((tag) => used.set(tag, (used.get(tag) || 0) + 1)),
  };
}

/**
 * Walks `order` and picks `count` albums, one per artist, keeping genres in proportion (see createTagLimiter). If that
 * leaves the list short, the limit is relaxed rather than returning fewer albums.
 */
function pickInProportion(state, order, count, onPick = () => {}) {
  const hasProfile = Object.keys(state.tasteTags || {}).length > 0;
  const limiter = createTagLimiter(state, count);
  const artists = new Set();
  const picks = [];
  const take = (candidate) => { artists.add(candidate.artistId); picks.push(candidate.id); limiter.take(candidate); onPick(candidate); };
  for (const candidate of order) {
    if (picks.length >= count) break;
    if (artists.has(candidate.artistId) || (hasProfile && !limiter.allows(candidate))) continue;
    take(candidate);
  }
  for (const candidate of order) { // relax the genre limit
    if (picks.length >= count) break;
    if (!artists.has(candidate.artistId)) take(candidate);
  }
  return picks;
}

/** "Best matches": the top candidates, one per artist, kept in proportion to the user's taste. */
export function pickBest(state, count, exclude) {
  const ranked = rankedCandidates(state, exclude);
  const picks = pickInProportion(state, ranked, count);
  for (const candidate of ranked) { // last resort: repeated artists
    if (picks.length >= count) break;
    if (!picks.includes(candidate.id)) picks.push(candidate.id);
  }
  return picks;
}

/**
 * "Surprise me": picks from deeper in the ranking (beyond what "Best matches" would show), skipping anything the
 * thermometer rejected. Marks the chosen candidates as surprises and returns their ids.
 */
export function pickSurprise(state, count, exclude) {
  const ranked = rankedCandidates(state, exclude);
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
  return pickInProportion(state, [...deeper, ...top, ...fillers], count, (candidate) => { candidate.surprise = true; });
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
  const eligible = state.owned.sources.filter((source) => isBandcampUrl(source.url) && sourceNet(state, source.url) > REJECTED_SOURCE_NET);
  const boosted = weightedShuffle(eligible.filter((source) => sourceNet(state, source.url) > 0), (s) => weigh(s.url))
    .slice(0, Math.ceil(count * BOOSTED_SOURCE_SHARE));
  const boostedUrls = new Set(boosted.map((source) => source.url));
  const rest = eligible.filter((source) => !boostedUrls.has(source.url));
  const neverRead = weightedShuffle(rest.filter((source) => !state.sampled[source.url]), (s) => weigh(s.url));
  const readBefore = weightedShuffle(rest.filter((source) => state.sampled[source.url]), (s) => weigh(s.url));
  return limitPerArtist([...likedAlbums, ...boosted, ...neverRead, ...readBefore], MAX_SOURCES_PER_ARTIST).slice(0, count);
}

/** Remembers that these albums (and their artists) were shown today: from tomorrow on they never come back. */
export function markShown(state, ids) {
  state.shownToday = [...new Set([...(state.shownToday || []), ...ids])];
  state.shownArtistsToday = [...new Set([...(state.shownArtistsToday || []), ...ids.map((id) => state.pool[id].artistId)])];
}

/**
 * List for a set of genres the user picked ("what do I want to hear today?"): albums that carry at least one of those tags,
 * the ones with more of them first. Albums whose tags weren't read still come from the user's albums of that genre, so they
 * fill the end of the list.
 */
export function pickFocused(state, count, keys, exclude, { allowUnknown = true } = {}) {
  const wanted = new Set(keys.map(normalizeTag));
  const ranked = rankedCandidates(state, exclude);
  // The genre must be one of the album's first tags: a tag far down the list is incidental, and a list for a DJ needs close matches.
  // What comes only from albums the user doesn't own (`hop`, see recommender.js) goes after what comes from theirs.
  const matches = (candidate) => (candidate.tags || []).slice(0, FOCUS_PRIMARY_TAGS).map(normalizeTag).filter((tag) => wanted.has(tag)).length;
  // How many of the user's albums recommend it: the more that do, the closer it is to what they have of that genre.
  const supporters = (candidate) => Object.keys(candidate.srcs || {}).length;
  const tagged = ranked.filter((candidate) => matches(candidate) > 0)
    .sort((a, b) => Boolean(a.hop) - Boolean(b.hop) || matches(b) - matches(a) || supporters(b) - supporters(a));
  const unknown = allowUnknown ? ranked.filter((candidate) => !candidate.tags) : [];
  const artists = new Set();
  const picks = [];
  for (const candidate of [...tagged, ...unknown]) {
    if (picks.length >= count) break;
    if (artists.has(candidate.artistId)) continue;
    artists.add(candidate.artistId);
    picks.push(candidate.id);
  }
  return picks;
}
