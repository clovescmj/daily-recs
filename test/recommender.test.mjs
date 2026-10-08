import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { refresh, refreshTags, extendList, applyFeedback, PHASE } from '../src/lib/recommender.js';
import { createSourceWeigher } from '../src/lib/taste-profile.js';
import { DAILY_COUNT } from '../src/lib/state.js';
import { createFakeBandcamp } from './helpers/fake-bandcamp.js';
import { createMemoryStore } from './helpers/memory-store.js';

const TUNING = { delayMs: 0, stagePauseMs: 0, retryDelayMs: 1, pageDelayMs: 0 };
const NOW = new Date(2026, 9, 7, 12);

async function setup(options) {
  const fake = createFakeBandcamp(options);
  const store = createMemoryStore();
  const run = (extra = {}) => refresh({ fetch: fake.fetch, store, tuning: TUNING, now: NOW, ...extra });
  return { fake, store, run };
}

const sourcePageCalls = (fake) => fake.calls.filter((c) => /src\d+\.bandcamp\.com/.test(c.url)).length;
const artistsOf = (state, ids) => ids.map((id) => state.pool[id].artistId);

describe('refresh', () => {
  test('builds a full list: DAILY_COUNT albums, one per artist, nothing the user owns, no duplicates', async () => {
    const { fake, store, run } = await setup();
    const state = await run();
    assert.equal(state.today.ids.length, DAILY_COUNT);
    assert.equal(new Set(state.today.ids).size, DAILY_COUNT);
    assert.equal(new Set(artistsOf(state, state.today.ids)).size, DAILY_COUNT);
    assert.ok(state.today.ids.every((id) => !fake.ownedIds.has(id)));
    assert.equal(store.getStatus().running, false);
    assert.equal(store.getStatus().error, undefined);
  });

  test('walks through the phases in order', async () => {
    const { store, run } = await setup();
    await run();
    const phases = [...new Set(store.statusLog.map((s) => s.phase).filter(Boolean))];
    assert.deepEqual(phases, [PHASE.SIGNING_IN, PHASE.LIBRARY, PHASE.SAMPLING, PHASE.RANKING, PHASE.TASTE, PHASE.PICKING]);
  });

  test('writes the large state only twice (checkpoint + final), progress goes to the small status key', async () => {
    const { store, run } = await setup();
    let saves = 0;
    const originalSave = store.save;
    store.save = async (s) => { saves++; return originalSave(s); };
    await run();
    assert.ok(saves <= 3, `expected at most 3 state writes, got ${saves}`);
    assert.ok(store.statusLog.length > 5, 'progress was published through setStatus');
  });

  test('is a no-op when today already has a list', async () => {
    const { fake, run } = await setup();
    const first = await run();
    const before = fake.calls.length;
    const second = await run();
    assert.equal(fake.calls.length, before, 'no network calls');
    assert.deepEqual(second.today.ids, first.today.ids);
  });

  test('what was shown on an earlier day never comes back, but lists of the same day may share albums', async () => {
    const { run } = await setup();
    const monday = await run({ now: new Date(2026, 9, 7, 12) });
    const surprise = await run({ mode: 'surprise', now: new Date(2026, 9, 7, 12) });
    assert.equal(surprise.surprise.ids.length, DAILY_COUNT);
    const tuesday = await run({ now: new Date(2026, 9, 8, 12) });
    assert.equal(tuesday.today.ids.length, DAILY_COUNT);
    const seenBefore = new Set([...monday.today.ids, ...surprise.surprise.ids]);
    assert.equal(tuesday.today.ids.filter((id) => seenBefore.has(id)).length, 0);
  });

  test('"surprise" is built next to the best list, which stays saved and untouched', async () => {
    const { run } = await setup();
    const best = await run();
    const bestIds = [...best.today.ids];
    const state = await run({ mode: 'surprise' });
    assert.deepEqual(state.today.ids, bestIds);
    assert.equal(state.surprise.ids.length, DAILY_COUNT);
    assert.equal(state.surprise.ids.filter((id) => bestIds.includes(id)).length, 0);
    assert.ok(state.surprise.ids.every((id) => state.pool[id].surprise === true));
    assert.ok(bestIds.every((id) => state.pool[id]), 'the best list keeps its card data');
  });

  test('"surprise" runs only once a day unless forced (switching views costs nothing)', async () => {
    const { fake, run } = await setup();
    await run();
    const first = await run({ mode: 'surprise' });
    const calls = fake.calls.length;
    const again = await run({ mode: 'surprise' });
    assert.equal(fake.calls.length, calls, 'no network calls');
    assert.deepEqual(again.surprise.ids, first.surprise.ids);
  });

  test('a rebuilt best list keeps the surprise list of the day (and the data of its cards)', async () => {
    const { run } = await setup();
    await run();
    const surprise = await run({ mode: 'surprise' });
    const state = await run({ force: true });
    assert.deepEqual(state.surprise.ids, surprise.surprise.ids);
    assert.ok(state.surprise.ids.every((id) => state.pool[id]));
  });

  test('keeps the pool small: only liked albums survive into the next run', async () => {
    const { store, run } = await setup();
    const first = await run();
    const state = await store.load();
    const sentinel = (id) => ({ id, artistId: `a${id}`, title: id, artist: id, url: `https://s.bandcamp.com/album/${id}`, srcs: { x: 1 } });
    state.pool.leftover = sentinel('leftover'); // a stale candidate from the previous run
    state.pool.kept = sentinel('kept');
    state.liked = ['kept'];
    await store.save(state);
    const second = await run({ force: true });
    assert.ok(!('leftover' in second.pool), 'stale candidates are dropped');
    assert.ok('kept' in second.pool, 'liked albums stay');
    assert.ok(first.today.ids.length > 0);
  });

  test('reports not_logged_in when nobody is signed in', async () => {
    const store = createMemoryStore();
    await refresh({ fetch: async () => ({ json: async () => ({ error: true }) }), store, tuning: TUNING, now: NOW });
    assert.equal(store.getStatus().running, false);
    assert.equal(store.getStatus().error, 'not_logged_in');
  });
});

describe('resilience', () => {
  test('stops after repeated failures instead of hammering Bandcamp (circuit breaker)', async () => {
    const { fake, store, run } = await setup();
    fake.failures.push({ match: /src\d+\.bandcamp\.com/, status: 429 });
    await run();
    assert.equal(store.getStatus().error, 'rate_limited');
    assert.ok(sourcePageCalls(fake) < 60, `made ${sourcePageCalls(fake)} source requests`);
    assert.equal(store.peek()?.today ?? null, null, "a failed run doesn't publish a list");
  });

  test('a 404 source is skipped without tripping the breaker', async () => {
    const { fake, store, run } = await setup();
    fake.failures.push({ match: /src(1|2|3|4|5|6|7|8|9)\.bandcamp\.com/, status: 404 });
    const state = await run();
    assert.equal(state.today.ids.length, DAILY_COUNT);
    assert.equal(store.getStatus().error, undefined);
  });

  test('a transient 503 is retried and the run still succeeds', async () => {
    const { fake, store, run } = await setup();
    fake.failures.push({ match: /src3\.bandcamp\.com/, status: 503, times: 2 });
    const state = await run();
    assert.equal(state.today.ids.length, DAILY_COUNT);
    assert.equal(store.getStatus().error, undefined);
  });
});

describe('variety', () => {
  test('two runs over the same library (a reinstall) do not return the same list: albums are drawn at random, from the whole library', async () => {
    const options = { libraryCount: 600, wishlistCount: 100, candidateCount: 1500, recsPerPage: 10 };
    const first = await (await setup(options)).run();
    const second = await (await setup(options)).run();
    const a = new Set(first.today.ids);
    const same = second.today.ids.filter((id) => a.has(id)).length;
    assert.ok(same < DAILY_COUNT * 0.8, `${same} of ${DAILY_COUNT} were the same`);
    const read = (state) => Object.keys(state.sampled).filter((url) => /src(\d+)/.test(url)).map((url) => Number(url.match(/src(\d+)/)[1]));
    assert.ok(new Set(read(first)).size > 0 && read(first).some((n) => n < 300) && read(first).some((n) => n >= 300), 'the albums read are spread over the whole library, not only the newest');
  });
});

describe('tags of candidates', () => {
  test('are read once: the next list of the day finds them in the cache', async () => {
    const ctx = await setup({ libraryCount: 120, wishlistCount: 0, candidateCount: 300, recsPerPage: 10, candidateTags: (i) => (i % 2 ? ['pop'] : ['ebm']) });
    await ctx.run();
    await ctx.run({ mode: 'surprise' });
    const reads = {};
    for (const call of ctx.fake.calls) if (/cand\d+\.bandcamp\.com/.test(call.url)) reads[call.url] = (reads[call.url] || 0) + 1;
    assert.ok(Object.keys(reads).length > 100, 'candidates were checked');
    assert.ok(Object.values(reads).every((n) => n === 1), 'and none of them twice');
    const state = await ctx.store.load();
    assert.ok(Object.keys(state.tagCache).length > 100);
  });

  test('are read again after a month, and the cache does not grow without limit', async () => {
    const ctx = await setup({ libraryCount: 60, wishlistCount: 0, candidateCount: 200, recsPerPage: 8 });
    await ctx.run();
    const state = await ctx.store.load();
    const ids = Object.keys(state.tagCache);
    state.tagCache[ids[0]].at = Date.now() - 31 * 86_400_000;
    for (let i = 0; i < 1600; i++) state.tagCache[`x${i}`] = { t: 'a', at: Date.now() - i };
    await ctx.store.save(state);
    await ctx.run({ mode: 'surprise', force: true });
    const after = await ctx.store.load();
    assert.ok(Object.keys(after.tagCache).length <= 1500);
  });
});

describe('lists built around genres the user picked', () => {
  const metalOptions = {
    libraryCount: 120, wishlistCount: 0, candidateCount: 600,
    sourceTags: (n) => (n % 4 === 0 ? ['metal', 'doom'] : ['pop']),             // a quarter of the user's albums are metal
    candidateTags: (i) => (i % 2 === 0 ? ['metal'] : ['pop']),
  };
  const setupTags = async (options = metalOptions) => {
    const ctx = await setup(options);
    const runTags = (extra = {}) => refreshTags({ fetch: ctx.fake.fetch, store: ctx.store, tags: ['metal'], tuning: TUNING, now: NOW, ...extra });
    return { ...ctx, runTags };
  };
  const candidateIndex = (state, id) => Number(state.pool[id].url.match(/cand(\d+)/)[1]);

  test('starts from the user\'s own albums of that genre: scans for them, then lists only albums of the genre', async () => {
    const { store, runTags, run } = await setupTags();
    await run(); // today's best list exists first, with its own data
    store.statusLog.length = 0;
    const state = await runTags();
    const list = state.tagLists.metal;
    assert.equal(list.ids.length, DAILY_COUNT);
    assert.ok(list.ids.every((id) => candidateIndex(state, id) % 2 === 0), 'only metal albums');
    assert.ok(store.statusLog.some((s) => s.phase === PHASE.SCANNING) || Object.keys(state.albumTags).length > 0);
    assert.equal(store.getStatus().error, undefined);
    assert.equal(store.getStatus().mode, 'tags');
    assert.ok(state.today.ids.every((id) => state.pool[id]), 'the best list keeps its card data');
  });

  test('with very few albums of the genre it looks one step further, to albums Bandcamp recommended, up to a small minimum', async () => {
    const { store, runTags } = await setupTags({
      libraryCount: 40, wishlistCount: 0, candidateCount: 600, recsPerPage: 5,
      sourceTags: (n) => (n % 13 === 0 ? ['metal'] : ['pop']),                    // 4 metal albums in 40
      candidateTags: (i) => (i % 2 === 0 ? ['metal'] : ['pop']),
    });
    const state = await runTags();
    const ids = state.tagLists.metal.ids;
    assert.ok(ids.length >= 20, `got ${ids.length}`);
    assert.ok(ids.every((id) => candidateIndex(state, id) % 2 === 0), 'only metal albums');
    const hops = ids.map((id) => Boolean(state.pool[id].hop));
    assert.ok(hops.some(Boolean), 'some come from the recommended ones');
    assert.equal(hops.indexOf(true), hops.length - hops.filter(Boolean).length, 'and they come last');
    assert.ok(Object.keys(state.albumTags).length <= 40, 'their tags did not enter the taste profile');
    assert.equal(store.getStatus().error, undefined);
  });

  test('a list with enough albums is not filled up to 50 with albums that do not match', async () => {
    const { runTags } = await setupTags({
      libraryCount: 120, wishlistCount: 0, candidateCount: 400, recsPerPage: 8,
      sourceTags: (n) => (n % 4 === 0 ? ['metal'] : ['pop']),
      candidateTags: (i) => (i % 20 === 0 ? ['metal'] : ['pop']),                 // few metal candidates
    });
    const state = await runTags();
    const ids = state.tagLists.metal.ids;
    assert.ok(ids.length > 0 && ids.length < 50);
    assert.ok(ids.every((id) => candidateIndex(state, id) % 20 === 0), 'only metal albums');
  });

  test('the genre must be among the first four tags of the album', async () => {
    const { runTags } = await setupTags({
      ...metalOptions,
      candidateTags: (i) => (i % 2 === 0 ? (i % 4 === 0 ? ['metal'] : ['pop', 'rock', 'indie', 'folk', 'metal']) : ['pop']), // half of the metal ones have it 5th
    });
    const state = await runTags();
    const ids = state.tagLists.metal.ids;
    assert.ok(ids.length > 0);
    assert.ok(ids.every((id) => candidateIndex(state, id) % 4 === 0), 'albums with the genre only as their 5th tag stay out');
  });

  test('a genre that is too broad (electronic, rock, ambient...) is ignored: no list for it, and it does not count in a list with others', async () => {
    const { store, runTags } = await setupTags();
    const only = await runTags({ tags: ['electronic'] });
    assert.deepEqual(only.tagLists, {}, 'nothing to build');
    const mixed = await runTags({ tags: ['rock', 'metal'] });
    assert.deepEqual(Object.keys(mixed.tagLists), ['metal'], 'only the specific one is kept');
    assert.equal(store.getStatus().error, undefined);
  });

  test('a song in the Liked list counts as one of the user\'s own albums of its genre: a list can start from it', async () => {
    const { store, fake, runTags, run } = await setupTags({ ...metalOptions, sourceTags: () => ['pop'] }); // nothing metal in the library
    const state = await run();
    const metalId = state.today.ids.find((id) => candidateIndex(state, id) % 2 === 0);
    await applyFeedback({ fetch: fake.fetch, store, id: metalId, kind: 'save', index: 0, track: 'Song', tuning: TUNING });
    const result = await runTags();
    assert.equal(store.getStatus().error, undefined, 'no "no seeds" error');
    assert.ok(result.tagLists.metal && result.tagLists.metal.ids.length > 0);
  });

  test('no list, and a clear reason, when none of the user\'s albums has the genre', async () => {
    const { store, runTags } = await setupTags({ ...metalOptions, sourceTags: () => ['pop'] });
    const state = await runTags();
    assert.equal(state.tagLists.metal, undefined);
    assert.equal(store.getStatus().error, 'no_seeds');
    assert.deepEqual(store.getStatus().tagLabels, ['metal']);
  });

  test('asking again the same day is free; the next day brings a list that never repeats', async () => {
    const { fake, runTags } = await setupTags();
    const first = await runTags();
    const calls = fake.calls.length;
    const again = await runTags();
    assert.equal(fake.calls.length, calls, 'no network calls');
    assert.deepEqual(again.tagLists.metal.ids, first.tagLists.metal.ids);
    const next = await runTags({ now: new Date(2026, 9, 8, 12) });
    assert.equal(next.tagLists.metal.date, '2026-10-08');
    assert.equal(next.tagLists.metal.ids.filter((id) => first.tagLists.metal.ids.includes(id)).length, 0);
  });

  test('different genre sets keep their own lists on the same day', async () => {
    const { runTags } = await setupTags();
    await runTags({ tags: ['metal'] });
    const state = await runTags({ tags: ['doom', 'metal'] });
    assert.deepEqual(Object.keys(state.tagLists).sort(), ['doom+metal', 'metal']);
  });
});

describe('one more album for a list', () => {
  const extend = (ctx, extra = {}) => extendList({ fetch: ctx.fake.fetch, store: ctx.store, tuning: TUNING, now: NOW, ...extra });

  test('adds a new album at the end of the best list, one that is not in it yet', async () => {
    const ctx = await setup();
    const state = await ctx.run();
    const before = [...state.today.ids];
    const id = await extend(ctx);
    const after = (await ctx.store.load()).today.ids;
    assert.ok(id && !before.includes(id));
    assert.deepEqual(after, [...before, id], 'at the end, the rest untouched');
    const saved = await ctx.store.load();
    assert.ok(saved.pool[id], 'with the data of its card');
    const artists = after.map((a) => saved.pool[a].artistId);
    assert.equal(new Set(artists).size, artists.length, 'still one album per artist');
  });

  test('works for the surprise list and for a genre list too', async () => {
    const ctx = await setup({ libraryCount: 120, wishlistCount: 0, candidateCount: 600, sourceTags: (n) => (n % 4 === 0 ? ['metal'] : ['pop']), candidateTags: (i) => (i % 2 === 0 ? ['metal'] : ['pop']) });
    await ctx.run();
    await ctx.run({ mode: 'surprise' });
    await refreshTags({ fetch: ctx.fake.fetch, store: ctx.store, tags: ['metal'], tuning: TUNING, now: NOW });
    const surpriseId = await extend(ctx, { view: 'surprise' });
    assert.ok(surpriseId);
    const tagId = await extend(ctx, { view: 'tags', tags: ['metal'] });
    const saved = await ctx.store.load();
    assert.ok(tagId && saved.tagLists.metal.ids.at(-1) === tagId);
    assert.ok(Number(saved.pool[tagId].url.match(/cand(\d+)/)[1]) % 2 === 0, 'a metal album');
  });

  test('a replacement for a genre list is really of that genre, even after the checked candidates run out', async () => {
    const ctx = await setup({ libraryCount: 120, wishlistCount: 0, candidateCount: 600, sourceTags: (n) => (n % 4 === 0 ? ['metal'] : ['pop']), candidateTags: (i) => (i % 2 === 0 ? ['metal'] : ['pop']) });
    await refreshTags({ fetch: ctx.fake.fetch, store: ctx.store, tags: ['metal'], tuning: TUNING, now: NOW });
    const isMetal = (state, id) => Number(state.pool[id].url.match(/cand(\d+)/)[1]) % 2 === 0;
    let found = 0;
    for (let i = 0; i < 20; i++) {
      const id = await extend(ctx, { view: 'tags', tags: ['metal'] });
      if (!id) break; // nothing of the genre left to offer: better no replacement than one of another genre
      found++;
      assert.ok(isMetal(await ctx.store.load(), id), `replacement ${i + 1} is a metal album`);
    }
    assert.ok(found >= 5, `found ${found}`);
  });

  test('keeps finding new albums, reading a few more of the user\'s albums when the run\'s leftovers are used up', async () => {
    const ctx = await setup({ libraryCount: 100, wishlistCount: 0, candidateCount: 120, recsPerPage: 6 });
    await ctx.run();
    const found = [];
    for (let i = 0; i < 25; i++) { const id = await extend(ctx); if (id) found.push(id); }
    assert.ok(found.length >= 20, `found ${found.length}`);
    assert.equal(new Set(found).size, found.length, 'never the same album twice');
    assert.ok(sourcePageCalls(ctx.fake) > 80, 'it did read more albums');
  });

  test('answers null when there is no list of that kind today', async () => {
    const ctx = await setup();
    await ctx.run();
    assert.equal(await extend(ctx, { view: 'surprise' }), null);
    assert.equal(await extend(ctx, { now: new Date(2026, 9, 9, 12) }), null, 'or if the list is from another day');
  });
});

describe('taste bootstrap', () => {
  test('the first run reads many more albums to learn the genre profile, once', async () => {
    const { fake, store, run } = await setup({ libraryCount: 400, wishlistCount: 0, sourceTags: () => ['metal'] });
    const first = await run();
    assert.ok(first.tasteBootstrapped);
    assert.ok(Object.keys(first.sampled).length >= 100, `read ${Object.keys(first.sampled).length}`);
    assert.ok(store.statusLog.some((s) => s.bootstrap === true));
    const before = sourcePageCalls(fake);
    await run({ force: true });
    assert.ok(sourcePageCalls(fake) - before < 100, 'later runs go back to the normal amount');
  });

  test('a list built before the profile existed is rebuilt once, even on the same day', async () => {
    const { store, run } = await setup();
    const first = await run();
    const saved = await store.load();
    saved.tasteBootstrapped = false; // what a state saved by the previous version looks like
    await store.save(saved);
    const second = await run();
    assert.equal(second.today.ids.length, first.today.ids.length);
    assert.ok(second.tasteBootstrapped);
    const third = await run();
    assert.deepEqual(third.today.ids, second.today.ids, 'and not again');
  });
});

describe('taste (genre tags)', () => {
  const tasteOptions = {
    libraryCount: 200, candidateCount: 900,
    sourceTags: () => ['metal', 'noise'],                        // everything the user owns is metal / noise
    candidateTags: (i) => (i % 2 === 0 ? ['metal', 'noise'] : ['schlager']),
  };
  const candidateIndex = (state, id) => Number(state.pool[id].url.match(/cand(\d+)/)[1]);

  test('builds a genre profile from the user\'s own albums, one count per source', async () => {
    const { run } = await setup(tasteOptions);
    const state = await run();
    assert.ok(state.tasteTags.metal > 0 && state.tasteTags.noise > 0);
    assert.equal(state.tasteTags.schlager, undefined);
    const sources = Object.keys(state.sampled).length;
    assert.ok(state.tasteTags.metal <= sources * 1.01, 'each source is counted once');
  });

  test('best matches prefer albums whose tags fit the taste', async () => {
    const { run } = await setup(tasteOptions);
    const state = await run();
    const fitting = state.today.ids.filter((id) => candidateIndex(state, id) % 2 === 0).length;
    assert.ok(fitting >= DAILY_COUNT * 0.6, `expected mostly fitting albums, got ${fitting}/${DAILY_COUNT}`);
  });

  test('surprise never picks an album that shares nothing with the taste', async () => {
    const { run } = await setup(tasteOptions);
    await run();
    const state = await run({ mode: 'surprise' });
    assert.ok(state.surprise.ids.every((id) => candidateIndex(state, id) % 2 === 0));
  });

  test('works when pages have no tags at all', async () => {
    const { run } = await setup();
    const state = await run();
    assert.equal(state.today.ids.length, DAILY_COUNT);
    assert.deepEqual(state.tasteTags, {});
  });
});

describe('feedback', () => {
  async function withList() {
    const ctx = await setup();
    const state = await ctx.run();
    return { ...ctx, state, id: state.today.ids[0] };
  }
  const apply = (ctx, kind, id = ctx.id) => applyFeedback({ fetch: ctx.fake.fetch, store: ctx.store, id, kind, tuning: TUNING });

  test('like → unlike restores neutral and leaves a tombstone', async () => {
    const ctx = await withList();
    let state = await apply(ctx, 'like');
    assert.deepEqual(state.liked, [ctx.id]);
    assert.ok(Object.values(state.sourceLikes).some((n) => n > 0));
    state = await apply(ctx, 'unlike');
    assert.deepEqual(state.liked, []);
    assert.ok(Object.values(state.sourceLikes).every((n) => n === 0));
    assert.match(state.votes[ctx.id], /^u\./);
  });

  test('a like also reads the liked album’s own recommendations right away', async () => {
    const ctx = await withList();
    const likedUrl = ctx.state.pool[ctx.id].url;
    const poolBefore = Object.keys((await ctx.store.load()).pool).length;
    const state = await apply(ctx, 'like');
    assert.ok(ctx.fake.calls.some((c) => c.url === likedUrl), 'the liked album page was requested');
    assert.ok(state.sampled[likedUrl], 'and remembered as read');
    assert.ok(Object.keys(state.pool).length >= poolBefore);
  });

  test('the wishlist is kept apart from the like: a heart is not a like, a like is not a heart', async () => {
    const ctx = await withList();
    let state = await apply(ctx, 'wish');
    assert.deepEqual(state.wishlisted, [ctx.id]);
    assert.deepEqual(state.liked, [], 'the wishlist is not a like');
    assert.ok(Object.values(state.sourceLikes).every((n) => n === 0), 'and does not move the thermometer');
    assert.ok(state.sampled[ctx.state.pool[ctx.id].url], 'but its own recommendations are read');
    state = await apply(ctx, 'like');
    assert.deepEqual(state.liked, [ctx.id]);
    state = await apply(ctx, 'unlike');
    assert.deepEqual(state.wishlisted, [ctx.id], 'removing the like leaves the wishlist as it was');
    state = await apply(ctx, 'unwish');
    assert.deepEqual(state.wishlisted, []);
    state = await apply(ctx, 'unwish');
    assert.deepEqual(state.wishlisted, [], 'repeating it changes nothing');
  });

  test('a dislike never touches the wishlist, and it replaces a like instead of adding to it', async () => {
    const ctx = await withList();
    await apply(ctx, 'wish');
    await apply(ctx, 'like');
    let state = await apply(ctx, 'dislike');
    assert.deepEqual(state.wishlisted, [ctx.id]);
    assert.deepEqual(state.liked, []);
    assert.deepEqual(state.dismissed, [ctx.id]);
    assert.ok(Object.values(state.sourceLikes).every((n) => n === 0), 'the like no longer counts');
    state = await apply(ctx, 'like');
    assert.deepEqual(state.dismissed, [], 'liking an album that was hidden brings it back');
    assert.ok(Object.values(state.sourceDislikes).every((n) => n === 0), 'and takes the dislike back');
  });

  test('"don\'t show music like this" remembers the artist and the albums Bandcamp pairs with it; undoing it forgets them', async () => {
    const ctx = await withList();
    const hidden = ctx.state.pool[ctx.id];
    let state = await apply(ctx, 'dislike');
    assert.deepEqual(state.dismissed, [ctx.id]);
    assert.equal(state.avoid[ctx.id].artistId, hidden.artistId);
    assert.ok(state.avoid[ctx.id].near.length > 0, 'its neighbours were read from its page');
    assert.ok(ctx.fake.calls.some((c) => c.url === hidden.url), 'one request to its page');
    state = await apply(ctx, 'undislike');
    assert.deepEqual(state.avoid, {});
    assert.ok(Object.values(state.sourceDislikes).every((n) => n === 0));
  });

  test('hidden from a genre list, an album stays out only of lists of those genres; it still counts as itself elsewhere', async () => {
    const ctx = await withList();
    const hidden = ctx.state.pool[ctx.id];
    let state = await applyFeedback({ fetch: ctx.fake.fetch, store: ctx.store, id: ctx.id, kind: 'dislike', tags: ['ebm'], tuning: TUNING });
    assert.deepEqual(state.dismissed, [], 'no global vote');
    assert.ok(Object.values(state.sourceDislikes).every((n) => n === 0), 'the thermometer is not touched');
    assert.deepEqual(state.avoid, {});
    assert.equal(state.scoped[ctx.id].artistId, hidden.artistId);
    assert.deepEqual(state.scoped[ctx.id].keys, ['ebm']);
    assert.ok(state.scoped[ctx.id].near.length > 0);
    state = await applyFeedback({ fetch: ctx.fake.fetch, store: ctx.store, id: ctx.id, kind: 'undislike', tuning: TUNING });
    assert.deepEqual(state.scoped, {}, 'undoing it forgets it');
  });

  test('hiding the same album outside a genre list makes it global, and what was hidden from one genre is absorbed', async () => {
    const ctx = await withList();
    await applyFeedback({ fetch: ctx.fake.fetch, store: ctx.store, id: ctx.id, kind: 'dislike', tags: ['ebm'], tuning: TUNING });
    const state = await apply(ctx, 'dislike');
    assert.deepEqual(state.dismissed, [ctx.id]);
    assert.deepEqual(state.scoped, {});
    assert.ok(state.avoid[ctx.id]);
  });

  test('a hidden album is never replaced by its neighbours or by another album of its artist', async () => {
    const ctx = await withList();
    let state = await apply(ctx, 'dislike');
    const { near, artistId } = state.avoid[ctx.id];
    const next = await ctx.run({ mode: 'surprise', force: true });
    for (const id of next.surprise.ids) {
      assert.ok(!near.includes(id), 'not a neighbour');
      assert.notEqual(next.pool[id].artistId, artistId, 'not the same artist');
    }
  });

  test('the Liked list keeps tracks (not albums), asks for nothing in the votes, and can be added to and taken out of', async () => {
    const ctx = await withList();
    const before = await ctx.store.load();
    const save = (id, index, track, kind = 'save') => applyFeedback({ fetch: ctx.fake.fetch, store: ctx.store, id, kind, index, track, tuning: TUNING });
    let state = await save(ctx.id, 2, 'Third song');
    assert.deepEqual(state.saved, [{ id: ctx.id, i: 2, title: 'Third song' }]);
    assert.deepEqual(state.votes, before.votes, 'no vote');
    assert.deepEqual(state.dismissed, []);
    state = await save(ctx.id, 0, 'First song');
    assert.equal(state.saved.length, 2, 'two tracks of the same album are two items');
    state = await save(ctx.id, 2, 'Third song');
    assert.deepEqual(state.saved.map((entry) => entry.i), [0, 2], 'adding again moves it to the end, never twice');
    state = await save(ctx.id, 0, '', 'unsave');
    assert.deepEqual(state.saved, [{ id: ctx.id, i: 2, title: 'Third song' }]);
  });

  test('the albums of the Liked list feed the search: they are read as sources, are never recommended again, and weigh like the library', async () => {
    const ctx = await withList();
    const url = ctx.state.pool[ctx.id].url;
    const state = await applyFeedback({ fetch: ctx.fake.fetch, store: ctx.store, id: ctx.id, kind: 'save', index: 1, track: 'Song', tuning: TUNING });
    assert.ok(state.sampled[url], 'its page was read right away (recommendations and tags)');
    const next = await ctx.run({ mode: 'surprise', force: true });
    assert.ok(next.pool[ctx.id], 'it stays in the pool');
    assert.ok(!next.surprise.ids.includes(ctx.id), 'and is not recommended again');
    assert.ok(createSourceWeigher(state)(url) > createSourceWeigher({ ...state, saved: [] })(url), 'it counts more than an ordinary source');
  });

  test('albums in the wishlist never come back in a list', async () => {
    const ctx = await withList();
    const [wished] = ctx.state.today.ids;
    await apply(ctx, 'wish', wished);
    const state = await ctx.run({ mode: 'surprise', force: true });
    assert.ok(!state.surprise.ids.includes(wished));
  });

  test('dislike → undislike returns the thermometer to zero and does not become a like', async () => {
    const ctx = await withList();
    let state = await apply(ctx, 'dislike');
    assert.deepEqual(state.dismissed, [ctx.id]);
    assert.ok(Object.values(state.sourceDislikes).some((n) => n > 0));
    state = await apply(ctx, 'undislike');
    assert.deepEqual(state.dismissed, []);
    assert.deepEqual(state.liked, []);
    assert.ok(Object.values(state.sourceDislikes).every((n) => n === 0));
    state = await apply(ctx, 'undislike');
    assert.ok(Object.values(state.sourceDislikes).every((n) => n === 0), 'repeating an undo changes nothing');
  });

  test('albums with a vote never come back in a later list', async () => {
    const ctx = await withList();
    await apply(ctx, 'dislike', ctx.state.today.ids[1]);
    await apply(ctx, 'like', ctx.state.today.ids[2]);
    const next = await ctx.run({ force: true });
    assert.ok(!next.today.ids.includes(ctx.state.today.ids[1]));
    assert.ok(!next.today.ids.includes(ctx.state.today.ids[2]));
  });

  test('ignores feedback for an unknown album', async () => {
    const ctx = await withList();
    const state = await apply(ctx, 'like', '123');
    assert.deepEqual(state.liked, []);
  });
});
