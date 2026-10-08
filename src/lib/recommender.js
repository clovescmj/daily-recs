// Orchestration: a "run" reads some of the user's albums from Bandcamp, ranks what they recommend, and builds today's list.
// Pure ES module: all browser APIs arrive through the `store` object and a `fetch` function, so it runs in the service
// worker and in Node tests.
//
//   store = {
//     load():                  Promise<state | null>
//     save(state):             Promise<void>      – persists the (large) state
//     setStatus(status):       Promise<void>      – publishes progress (small, frequent, not part of the state)
//   }
import {
  NotLoggedInError, RateLimitedError, HttpError, fetchText, getFan, isBandcampUrl, loadLibrary, normalizeTag, parseRecommendations, parseTagLabels, parseTags, sleep,
} from './bandcamp.js';
import { addTasteTags, createSourceWeigher, recordSourceRead, tagsOfAlbum } from './taste-profile.js';
import { hashSource, recordVote, rebuildVoteLists, VOTE } from './taste-sync.js';
import { DAILY_COUNT, emptyState, idsOfTodaysLists, migrateState, rollShownOver, tagListKey, todayKey } from './state.js';
import { markShown, pickBest, pickFocused, pickSources, pickSurprise, rankedCandidates } from './ranking.js';
import { scanSources } from './scanner.js';

const SAMPLES_PER_RUN = 60;
const FIRST_RUN_EXTRA_SAMPLES = 20;   // the very first run reads more albums so it can fill the list right away
const TASTE_BOOTSTRAP_SOURCES = 100;  // the first run reads many more albums, to learn the genre profile properly at once
const TOP_UP_SAMPLES = 40;
const MAX_TOP_UPS = 2;
const SAMPLE_CONCURRENCY = 2;
const SAMPLE_DELAY_MS = 800;          // politeness delay between requests (plus up to 50% random, so it doesn't look like a clock)
const MAX_CONSECUTIVE_FAILURES = 6;   // circuit breaker: stop hammering Bandcamp when it keeps failing
const TASTE_CHECK_BEST = 120;          // candidates whose genre tags are read before picking "best matches"
const TASTE_CHECK_SURPRISE = 150;     // surprise picks from deeper in the ranking, so it looks further
const PROGRESS_INTERVAL_MS = 400;
const STAGE_PAUSE_MS = 500;           // lets the user read a quick stage

/** Phases published in the status. */
export const PHASE = Object.freeze({
  SIGNING_IN: 'signing-in',
  LIBRARY: 'library',
  SAMPLING: 'sampling',
  RANKING: 'ranking',
  TASTE: 'taste',
  SCANNING: 'scanning',   // reading more of the user's albums to find the ones of a genre
  PICKING: 'picking',
});

/** Pacing knobs. Tests pass smaller values; production uses these defaults. */
const withDefaults = (tuning = {}) => ({
  delayMs: SAMPLE_DELAY_MS, stagePauseMs: STAGE_PAUSE_MS, retryDelayMs: undefined, pageDelayMs: undefined, ...tuning,
});
const httpOptions = (pacing) => ({ baseDelayMs: pacing.retryDelayMs, pageDelayMs: pacing.pageDelayMs });

const chooser = (mode) => (mode === 'surprise' ? pickSurprise : pickBest);

function errorCode(error) {
  if (error instanceof NotLoggedInError) return 'not_logged_in';
  if (error instanceof RateLimitedError) return 'rate_limited';
  return String((error && error.message) || error);
}

/** Waits `ms` plus up to 50% at random. */
const politePause = (ms) => sleep(ms ? ms + Math.random() * ms * 0.5 : 0);

/** Publishes progress. `report(patch)` always writes; `report.throttled(patch)` skips writes that come too soon. */
function createReporter(store, base) {
  let lastWrite = 0;
  const report = (patch) => { lastWrite = Date.now(); return store.setStatus({ running: true, ...base, ...patch }); };
  report.throttled = (patch) => (Date.now() - lastWrite < PROGRESS_INTERVAL_MS ? undefined : report(patch));
  return report;
}

// ---------------------------------------------------------------------------------------------------------------------
// Reading sources
// ---------------------------------------------------------------------------------------------------------------------

function addCandidates(state, source, recommendations) {
  for (const rec of recommendations) {
    if (!rec.artist || /^(various artists|compilation)$/i.test(rec.artist) || /various artists/i.test(rec.title)) continue;
    const candidate = (state.pool[rec.id] ||= { ...rec, srcs: {} });
    candidate.srcs[source.url] = rec.fans || 1;
    candidate.via = rec.ownedTitle || candidate.via || source.title;
  }
}

/** Reads the "you may also like" section of each source into the candidate pool. Throws if Bandcamp keeps failing. */
async function readSources(fetchFn, state, sources, onProgress = () => {}, pacing = withDefaults()) {
  const queue = [...sources];
  const weigh = createSourceWeigher(state);
  let done = 0;
  let consecutiveFailures = 0;
  let lastError = null;

  async function worker() {
    while (queue.length && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      const source = queue.shift();
      try {
        const html = await fetchText(fetchFn, source.url, httpOptions(pacing));
        addCandidates(state, source, parseRecommendations(html));
        recordSourceRead(state, source.url, parseTagLabels(html), weigh(source.url)); // tags of this album, and (once) its share of the profile
        state.sampled[source.url] = Date.now();
        consecutiveFailures = 0;
      } catch (error) {
        if (error instanceof HttpError && error.status < 500) {
          state.sampled[source.url] = Date.now(); // e.g. 404: the album is gone, don't pick it again
        } else {
          consecutiveFailures++;
          lastError = error;
        }
      }
      onProgress(++done, sources.length);
      await politePause(pacing.delayMs);
    }
  }
  await Promise.all(Array.from({ length: SAMPLE_CONCURRENCY }, worker));
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    throw lastError instanceof RateLimitedError ? lastError : new Error("Bandcamp isn't responding right now. Try again in a few minutes.");
  }
}

const TAG_CACHE_MAX = 1500;                     // entries kept (about 80 KB)
const TAG_CACHE_DAYS = 30;                      // an album's tags are read again after this long, in case the artist edited them

/** Gives the candidates whose tags were read in an earlier run their tags back, without a request. */
function applyCachedTags(state) {
  const cutoff = Date.now() - TAG_CACHE_DAYS * 86_400_000;
  for (const candidate of Object.values(state.pool)) {
    const entry = !candidate.tags && state.tagCache[candidate.id];
    if (entry && entry.at >= cutoff) candidate.tags = entry.t ? entry.t.split('|') : [];
  }
}

function rememberTags(state, candidate) {
  state.tagCache[candidate.id] = { t: candidate.tags.join('|'), at: Date.now() };
  const ids = Object.keys(state.tagCache);
  if (ids.length <= TAG_CACHE_MAX) return;
  const oldest = ids.sort((a, b) => state.tagCache[a].at - state.tagCache[b].at).slice(0, ids.length - TAG_CACHE_MAX);
  for (const id of oldest) delete state.tagCache[id];
}

/**
 * Reads the genre tags of the best-ranked candidates so the final order can take the user's taste into account.
 * Tags are optional: a page that fails to load just keeps its score without them.
 */
async function readCandidateTags(fetchFn, state, limit, onProgress, pacing) {
  applyCachedTags(state);
  const queue = rankedCandidates(state).slice(0, limit).filter((candidate) => !candidate.tags && isBandcampUrl(candidate.url));
  const total = queue.length;
  let done = 0;
  let consecutiveFailures = 0;
  async function worker() {
    while (queue.length && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      const candidate = queue.shift();
      try {
        candidate.tags = parseTags(await fetchText(fetchFn, candidate.url, httpOptions(pacing)));
        rememberTags(state, candidate);
        consecutiveFailures = 0;
      } catch {
        consecutiveFailures++;
      }
      onProgress(++done, total);
      await politePause(pacing.delayMs);
    }
  }
  await Promise.all(Array.from({ length: SAMPLE_CONCURRENCY }, worker));
  return total;
}

/** Tag check with progress, then the choice itself: the order depends on the tags, so they come first. */
async function pickWithTaste({ fetchFn, state, mode, count, report, pacing }) {
  const limit = mode === 'surprise' ? TASTE_CHECK_SURPRISE : TASTE_CHECK_BEST;
  const total = await readCandidateTags(fetchFn, state, limit, (done, of) => report.throttled({ phase: PHASE.TASTE, done, total: of }), pacing);
  if (total) await report({ phase: PHASE.TASTE, done: total, total });
  return chooser(mode)(state, count);
}

/** Reads `sources`, publishing progress; `extra` is merged into every status update. */
async function readWithProgress(fetchFn, state, sources, report, extra, pacing) {
  const total = sources.length;
  await report({ phase: PHASE.SAMPLING, done: 0, total, ...extra });
  await readSources(fetchFn, state, sources, (done) => {
    const patch = { phase: PHASE.SAMPLING, done, total, ...extra };
    return done === total ? report(patch) : report.throttled(patch);
  }, pacing);
}

// ---------------------------------------------------------------------------------------------------------------------
// A full run (new day, or "Surprise me")
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Builds a list for today. Two lists can exist side by side: `state.today` (best matches, built first) and
 * `state.surprise` (deeper in the ranking, built only when asked). Without `force` this is a no-op when the list for
 * `mode` already exists. A new best list invalidates the surprise one.
 * mode: 'best' (top matches) or 'surprise'.
 */
export async function refresh({ fetch: fetchFn, store, force = false, mode = 'best', sampleCount = SAMPLES_PER_RUN, now = new Date(), tuning }) {
  const pacing = withDefaults(tuning);
  const state = migrateState((await store.load()) || emptyState());
  const today = todayKey(now);
  rollShownOver(state, today);

  const existing = mode === 'surprise' ? state.surprise : state.today;
  // A best list built before the taste profile existed is rebuilt once, so the new ranking applies right away.
  const outdated = mode === 'best' && !state.tasteBootstrapped;
  if (!force && !outdated && existing && existing.date === today) {
    if (!state.profileUrl) await rememberProfileUrl(fetchFn, state, store); // state saved by an older version
    return state;
  }

  const report = createReporter(store, { mode, scope: 'list' });
  await report({ phase: PHASE.SIGNING_IN });
  try {
    const fan = await getFan(fetchFn);
    // No stockpile: every run fetches a fresh batch. Liked albums stay in the pool (they keep acting as sources), and so
    // do the albums of today's other lists (their cards still need their data).
    const keep = new Set([...state.liked, ...state.wishlisted, ...idsOfTodaysLists(state, today)]);
    state.pool = Object.fromEntries([...keep].filter((id) => state.pool[id]).map((id) => [id, state.pool[id]]));
    await report({ phase: PHASE.LIBRARY });
    state.owned = await loadLibrary(fetchFn, fan.profileUrl, httpOptions(pacing));
    state.fanId = fan.fanId;
    state.profileUrl = fan.profileUrl;

    const firstRun = Object.keys(state.sampled).length === 0;
    const bootstrap = !state.tasteBootstrapped;
    const wanted = bootstrap ? Math.max(sampleCount, TASTE_BOOTSTRAP_SOURCES) : firstRun ? sampleCount + FIRST_RUN_EXTRA_SAMPLES : sampleCount;
    const sources = pickSources(state, wanted);
    const likedUrls = new Set(state.liked.map((id) => state.pool[id] && state.pool[id].url).filter(Boolean));
    const info = {
      library: state.owned.sources.length,
      picked: sources.length,
      likedPicked: sources.filter((source) => likedUrls.has(source.url)).length,
      bootstrap,
    };
    await readWithProgress(fetchFn, state, sources, report, info, pacing);
    await store.save(state); // checkpoint: the candidates survive even if the rest of the run is interrupted

    await report({ phase: PHASE.RANKING, candidates: Object.keys(state.pool).length });
    await sleep(pacing.stagePauseMs);
    let ids = await pickWithTaste({ fetchFn, state, mode, count: DAILY_COUNT, report, pacing });
    await report({ phase: PHASE.PICKING });
    for (let top = 0; top < MAX_TOP_UPS && ids.length < DAILY_COUNT; top++) { // make sure the list is full
      const more = pickSources(state, TOP_UP_SAMPLES);
      if (!more.length) break;
      await readWithProgress(fetchFn, state, more, report, { ...info, picked: more.length }, pacing);
      ids = await pickWithTaste({ fetchFn, state, mode, count: DAILY_COUNT, report, pacing });
    }
    markShown(state, ids);
    if (mode === 'surprise') state.surprise = { date: today, ids };
    else state.today = { date: today, ids };
    state.tasteBootstrapped = true;
    await store.save(state);
    await store.setStatus({ running: false, finishedAt: Date.now(), scope: 'list' });
  } catch (error) {
    await store.setStatus({ running: false, error: errorCode(error), scope: 'list' });
  }
  return state;
}

// ---------------------------------------------------------------------------------------------------------------------
// A list built around genres the user picked ("what do I want to hear today?")
// ---------------------------------------------------------------------------------------------------------------------

const MIN_SEEDS = 12;               // fewer albums of the genre than this: look for more of them first
const SCAN_FOR_SEEDS = 60;          // how many unread albums are read to find them
const SEED_READS = 60;              // albums of the genre whose "you may also like" is read
const TASTE_CHECK_FOCUSED = 150;
const STRICT_TAG_CHECK = 300;       // a list that came out short: the genre tags of this many candidates are read (never more than that)
const MAX_TAGS_PER_LIST = 5;
const MAX_TAG_LISTS = 6;

/** The user's albums that carry any of the tags, the ones with more of them first. */
function seedsFor(state, keys) {
  const wanted = new Set(keys);
  return (state.owned.sources || [])
    .filter((source) => isBandcampUrl(source.url))
    .map((source) => ({ source, matches: tagsOfAlbum(state, source.url).filter((tag) => wanted.has(tag)).length }))
    .filter(({ matches }) => matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .map(({ source }) => source);
}

/**
 * Builds today's list for a set of genres, starting from the user's own albums with those tags (bought or saved): their
 * "you may also like" sections are read, and what comes out keeps only albums of the genre. If the user has few albums
 * of that genre scanned so far, more of their albums are read first. Without a single one, no list is made.
 */
export async function refreshTags({ fetch: fetchFn, store, tags, force = false, now = new Date(), tuning }) {
  const pacing = withDefaults(tuning);
  const keys = [...new Set((tags || []).map(normalizeTag).filter(Boolean))].slice(0, MAX_TAGS_PER_LIST).sort();
  const state = migrateState((await store.load()) || emptyState());
  if (!keys.length) return state;
  const today = todayKey(now);
  rollShownOver(state, today);
  const listKey = tagListKey(keys);
  const labels = keys.map((key) => (state.tagLabels || {})[key] || key);
  if (!force && state.tagLists[listKey] && state.tagLists[listKey].date === today) return state;

  const report = createReporter(store, { mode: 'tags', scope: 'list', tagLabels: labels, tags: keys });
  await report({ phase: PHASE.SIGNING_IN });
  try {
    if (!state.owned) {
      const fan = await getFan(fetchFn);
      await report({ phase: PHASE.LIBRARY });
      state.owned = await loadLibrary(fetchFn, fan.profileUrl, httpOptions(pacing));
      state.fanId = fan.fanId;
      state.profileUrl = fan.profileUrl;
    }
    let seeds = seedsFor(state, keys);
    if (seeds.length < MIN_SEEDS) { // not enough albums of this genre known yet: read more of the user's albums
      await report({ phase: PHASE.SCANNING, done: 0, total: SCAN_FOR_SEEDS });
      await scanSources({ fetch: fetchFn, state, count: SCAN_FOR_SEEDS, tuning: pacing, now: now.getTime(), onProgress: (done, total) => report.throttled({ phase: PHASE.SCANNING, done, total }) });
      await store.save(state); // what was learned is kept even if nothing comes out of this list
      seeds = seedsFor(state, keys);
    }
    if (!seeds.length) {
      await store.setStatus({ running: false, error: 'no_seeds', scope: 'list', mode: 'tags', tagLabels: labels });
      return state;
    }

    state.pool = Object.fromEntries([...new Set([...state.liked, ...state.wishlisted, ...idsOfTodaysLists(state, today)])].filter((id) => state.pool[id]).map((id) => [id, state.pool[id]]));
    const read = new Set();
    const nextSeeds = (count) => {
      const fresh = seeds.filter((source) => !read.has(source.url)).slice(0, count);
      fresh.forEach((source) => read.add(source.url));
      return fresh;
    };
    const first = nextSeeds(SEED_READS);
    const info = { library: state.owned.sources.length, picked: first.length, likedPicked: 0 };
    await readWithProgress(fetchFn, state, first, report, info, pacing);
    await store.save(state);

    await report({ phase: PHASE.RANKING, candidates: Object.keys(state.pool).length });
    const pick = async (depth = TASTE_CHECK_FOCUSED) => {
      await readCandidateTags(fetchFn, state, depth, (done, total) => report.throttled({ phase: PHASE.TASTE, done, total }), pacing);
      return pickFocused(state, DAILY_COUNT, keys, undefined, { allowUnknown: false }); // only albums whose genre was checked
    };
    let ids = await pick();
    await report({ phase: PHASE.PICKING });
    for (let top = 0; top < MAX_TOP_UPS && ids.length < DAILY_COUNT; top++) { // more seeds if the list came out short
      const more = nextSeeds(TOP_UP_SAMPLES);
      if (!more.length) break;
      await readWithProgress(fetchFn, state, more, report, { ...info, picked: more.length }, pacing);
      ids = await pick();
    }
    if (ids.length < DAILY_COUNT) ids = await pick(STRICT_TAG_CHECK); // short: the genre of more candidates is checked, but the list is never filled with albums that don't match
    markShown(state, ids);
    state.tagLists[listKey] = { date: today, ids, tags: keys };
    const lists = Object.entries(state.tagLists).filter(([, list]) => list.date === today); // keep the latest few
    for (const [key] of lists.slice(0, Math.max(0, lists.length - MAX_TAG_LISTS))) delete state.tagLists[key];
    await store.save(state);
    await store.setStatus({ running: false, finishedAt: Date.now(), scope: 'list', mode: 'tags', tagLabels: labels });
  } catch (error) {
    await store.setStatus({ running: false, error: errorCode(error), scope: 'list', mode: 'tags', tagLabels: labels, tags: keys });
  }
  return state;
}

// ---------------------------------------------------------------------------------------------------------------------
// One more album for a list (when the user hides one, a new one takes its place at the end)
// ---------------------------------------------------------------------------------------------------------------------

const EXTEND_TAG_CHECK = 400;   // how deep into the leftovers the tags are read when none of the checked ones is left
const EXTEND_READS = 25;
const EXTEND_SCAN = 40;    // for a genre list: how many more of the user's albums are scanned to find albums of that genre   // when the candidates left over from the run are used up: read this many more albums, quietly
const quiet = Object.assign(() => Promise.resolve(), { throttled: () => undefined });

/**
 * Adds one new album to the end of today's list for `view` ('best', 'surprise' or 'tags'), chosen like the others (same rules,
 * nothing that is already in that list). It uses what the run left over; if nothing is left it reads a few more of the user's
 * albums, without touching the progress status. Returns the id of the new album, or null.
 */
export async function extendList({ fetch: fetchFn, store, view = 'best', tags = [], now = new Date(), tuning }) {
  const pacing = withDefaults(tuning);
  const state = migrateState((await store.load()) || emptyState());
  const today = todayKey(now);
  const keys = [...new Set((tags || []).map(normalizeTag).filter(Boolean))].sort();
  const list = view === 'surprise' ? state.surprise : view === 'tags' ? state.tagLists[tagListKey(keys)] : state.today;
  if (!list || list.date !== today || !state.owned) return null;
  const exclude = () => ({ ids: list.ids, artists: list.ids.map((id) => state.pool[id] && state.pool[id].artistId).filter(Boolean) });
  // For a genre list the new album must really be of that genre: albums whose tags were never read are not taken on trust.
  const pick = () => (view === 'surprise' ? pickSurprise : view === 'tags' ? (s, n, e) => pickFocused(s, n, keys, e, { allowUnknown: false }) : pickBest)(state, 1, exclude());

  try {
    let [id] = pick();
    if (!id && view === 'tags') { // read the tags of more of the leftovers, and check them against the genre
      await readCandidateTags(fetchFn, state, EXTEND_TAG_CHECK, () => {}, pacing);
      [id] = pick();
    }
    if (!id) { // nothing left from the run: read a few more albums
      const unreadSeeds = () => seedsFor(state, keys).filter((source) => !state.sampled[source.url]).slice(0, EXTEND_READS);
      let sources = view === 'tags' ? unreadSeeds() : pickSources(state, EXTEND_READS);
      if (view === 'tags' && !sources.length) { // every known album of the genre was used: look for more of them among the user's albums
        await scanSources({ fetch: fetchFn, state, count: EXTEND_SCAN, tuning: pacing, now: now.getTime() });
        sources = unreadSeeds();
      }
      if (sources.length) {
        await readWithProgress(fetchFn, state, sources, quiet, {}, pacing);
        await readCandidateTags(fetchFn, state, TASTE_CHECK_FOCUSED, () => {}, pacing);
        [id] = pick();
      }
    }
    if (!id) { await store.save(state); return null; }
    list.ids.push(id);
    markShown(state, [id]);
    await store.save(state);
    return id;
  } catch {
    return null;
  }
}

async function rememberProfileUrl(fetchFn, state, store) {
  try {
    state.profileUrl = (await getFan(fetchFn)).profileUrl;
    await store.save(state);
  } catch { /* the toolbar button opens Bandcamp's home until the next run */ }
}

// ---------------------------------------------------------------------------------------------------------------------
// Feedback: like / unlike / dislike / undislike
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Applies a vote. Votes move the thermometer points of the album's sources; a like also reads the liked album's own
 * recommendations right away, so the taste becomes new candidates without waiting for the next day. Putting an album in the
 * wishlist (the heart) is remembered apart from the like, and it is read the same way.
 * kind: 'like' | 'unlike' | 'dislike' | 'undislike' | 'wish' | 'unwish'
 */
export async function applyFeedback({ fetch: fetchFn, store, id, kind, tags = [], tuning }) {
  const state = await store.load();
  const candidate = state && state.pool[id];
  if (!candidate) return state;
  migrateState(state);

  const sourceUrls = [...Object.keys(candidate.srcs || {}), candidate.url];
  // The album's own URL counts double for likes; everything else counts once. Scores never go below zero.
  const adjust = (scores, delta, ownWeight = 1) => {
    for (const url of sourceUrls) {
      const key = hashSource(url);
      scores[key] = Math.max(0, (scores[key] || 0) + delta * (url === candidate.url ? ownWeight : 1));
    }
  };

  const readOwnRecommendations = async () => {
    if (!state.sampled[candidate.url] && isBandcampUrl(candidate.url)) {
      try { await readSources(fetchFn, state, [{ url: candidate.url, title: candidate.title }], undefined, withDefaults(tuning)); } catch { /* the vote itself is already recorded */ }
    }
  };

  if (kind === 'like' && !state.liked.includes(id)) {
    if (state.dismissed.includes(id)) { // a like replaces the dislike
      adjust(state.sourceDislikes, state.focusDislikes[id] ? -2 : -1);
      delete state.focusDislikes[id];
    }
    recordVote(state, id, VOTE.LIKE);
    adjust(state.sourceLikes, +1, 2);
    rebuildVoteLists(state);
    await store.save(state);
    await readOwnRecommendations();
  } else if (kind === 'wish' && !state.wishlisted.includes(id)) {
    state.wishlisted.push(id);
    await store.save(state);
    await readOwnRecommendations();
  } else if (kind === 'unwish') {
    state.wishlisted = state.wishlisted.filter((other) => other !== id);
  } else if (kind === 'unlike' && state.liked.includes(id)) {
    recordVote(state, id, VOTE.UNLIKE); // tombstone, so the removal also spreads to other devices
    adjust(state.sourceLikes, -1, 2);
    rebuildVoteLists(state);
  } else if (kind === 'dislike' && !state.dismissed.includes(id)) {
    if (state.liked.includes(id)) adjust(state.sourceLikes, -1, 2); // a dislike replaces the like
    recordVote(state, id, VOTE.DISLIKE);
    adjust(state.sourceDislikes, +1);
    const keys = [...new Set((tags || []).map(normalizeTag).filter(Boolean))];
    if (keys.length) { // hidden from a genre list: it counts twice, and what the album has besides the genre is held against it there
      adjust(state.sourceDislikes, +1);
      state.focusDislikes[id] = { keys, tags: [...new Set((candidate.tags || []).map(normalizeTag).filter(Boolean))] };
    }
    rebuildVoteLists(state);
  } else if (kind === 'undislike' && state.dismissed.includes(id)) {
    recordVote(state, id, VOTE.UNDISLIKE); // back to neutral: only undoes the points the dislike gave
    adjust(state.sourceDislikes, -1);
    if (state.focusDislikes[id]) { adjust(state.sourceDislikes, -1); delete state.focusDislikes[id]; }
    rebuildVoteLists(state);
  }
  await store.save(state);
  return state;
}
