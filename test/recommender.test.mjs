import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { refresh, applyFeedback, PHASE } from '../src/lib/recommender.js';
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

  test('"Refresh" (force) brings a new batch that never repeats the previous one', async () => {
    const { run } = await setup();
    const first = await run();
    const second = await run({ force: true });
    assert.equal(second.today.ids.length, DAILY_COUNT);
    assert.equal(second.today.ids.filter((id) => first.today.ids.includes(id)).length, 0);
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

  test('a new best list invalidates the surprise one', async () => {
    const { run } = await setup();
    await run();
    await run({ mode: 'surprise' });
    const state = await run({ force: true });
    assert.equal(state.surprise, null);
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
    assert.notDeepEqual(second.today.ids, first.today.ids);
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
    assert.ok(fitting >= DAILY_COUNT * 0.85, `expected almost only fitting albums, got ${fitting}/${DAILY_COUNT}`);
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
