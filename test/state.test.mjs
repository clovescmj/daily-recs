import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, dequeueWishlistOp, emptyState, migrateState, queueWishlistOp, todayKey } from '../src/lib/state.js';
import { hashSource } from '../src/lib/taste-sync.js';
import { wishlistOpInPage } from '../src/background/wishlist-in-page.js';

describe('migrateState', () => {
  test('upgrades a state saved by an older version without losing data', () => {
    const legacy = {
      pool: { a: { id: 'a' } }, liked: ['1'], dismissed: ['2'], shown: ['3'], shownArtists: [],
      tasteTs: { 1: 'l.abc' },
      likedSrc: { 'https://s.bandcamp.com/album/x': 2 }, dislikedSrc: {},
      owned: { ids: [], bandIds: [], urls: [], sources: [], count: 331, wishCount: 1271, name: 'Someone' },
      status: { running: true }, wished: ['x'], focus: 'f', opened: ['o'], fanName: 'Someone',
      today: { date: '2026-01-01', ids: ['a'] },
    };
    const state = migrateState(legacy);
    assert.equal(state.schemaVersion, SCHEMA_VERSION);
    assert.equal(state.votes['1'], 'l.abc');
    assert.equal(state.votes['2'].split('.')[0], 'd', 'dislikes without a timestamp get one');
    assert.equal(state.sourceLikes[hashSource('https://s.bandcamp.com/album/x')], 2);
    assert.equal(state.owned.collectionCount, 331);
    assert.equal(state.owned.wishlistCount, 1271);
    for (const gone of ['status', 'wished', 'focus', 'opened', 'fanName', 'tasteTs', 'likedSrc']) assert.ok(!(gone in state), gone);
    assert.deepEqual(state.today.ids, ['a']);
    assert.ok(Array.isArray(state.wishQueue));
  });

  test('is idempotent', () => {
    const once = migrateState(emptyState());
    assert.deepEqual(migrateState(structuredClone(once)), once);
  });
});

test('todayKey formats the local date', () => assert.equal(todayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05'));

describe('wishlist queue', () => {
  test('queues operations without duplicating them', () => {
    const state = emptyState();
    queueWishlistOp(state, { op: 'add', id: 'a', bandId: 'b1' });
    queueWishlistOp(state, { op: 'add', id: 'c', bandId: 'b2' });
    queueWishlistOp(state, { op: 'add', id: 'a', bandId: 'b1' });
    assert.equal(state.wishQueue.length, 2);
  });

  test('opposite operations on the same album cancel each other', () => {
    const state = emptyState();
    queueWishlistOp(state, { op: 'add', id: 'a', bandId: 'b1' });
    queueWishlistOp(state, { op: 'remove', id: 'a', bandId: 'b1' });
    assert.deepEqual(state.wishQueue, []);
  });

  test('dequeue removes an entry', () => {
    const state = emptyState();
    queueWishlistOp(state, { op: 'add', id: 'a', bandId: 'b1' });
    dequeueWishlistOp(state, 'a');
    assert.deepEqual(state.wishQueue, []);
  });
});

describe('wishlistOpInPage (runs inside the Bandcamp page)', () => {
  const installPage = ({ respond = true, delay = 20 } = {}) => {
    globalThis.document = { createElement: () => ({}) };
    globalThis.CurrentFan = { fan_id: 1, collection_count: 100 };
    globalThis.Fanpage = {
      calls: [],
      collectItem(...args) { this.calls.push(['collect', ...args]); if (respond) setTimeout(() => CurrentFan.collection_count++, delay); },
      uncollectItem(...args) { this.calls.push(['uncollect', ...args]); if (respond) setTimeout(() => CurrentFan.collection_count--, delay); },
    };
  };
  const uninstallPage = () => { delete globalThis.Fanpage; delete globalThis.CurrentFan; delete globalThis.document; };

  test('adds and removes, confirming through the counter, with the arguments Bandcamp expects', async () => {
    installPage();
    assert.deepEqual(await wishlistOpInPage({ op: 'add', id: '111', bandId: '222' }), { ok: true });
    assert.deepEqual(Fanpage.calls[0], ['collect', '111', 'album', '222', 'a111', {}]);
    assert.deepEqual(await wishlistOpInPage({ op: 'remove', id: '111', bandId: '222' }), { ok: true });
    assert.equal(Fanpage.calls[1][0], 'uncollect');
    uninstallPage();
  });

  test('does not pretend success when Bandcamp never confirms', async () => {
    installPage({ respond: false });
    const result = await wishlistOpInPage({ op: 'add', id: '1', bandId: '2', timeoutMs: 150 });
    assert.equal(result.ok, false);
    assert.match(result.error, /no confirmation/);
    uninstallPage();
  });

  test('fails clearly outside the profile page', async () => {
    uninstallPage();
    assert.match((await wishlistOpInPage({ op: 'add', id: '1', bandId: '2' })).error, /profile page/);
  });

  test('refuses to guess when the counter is not numeric', async () => {
    installPage(); CurrentFan.collection_count = undefined;
    assert.match((await wishlistOpInPage({ op: 'add', id: '1', bandId: '2' })).error, /verify/);
    uninstallPage();
  });

  test('an exception after the request left does not break the result', async () => {
    installPage(); Fanpage.collectItem = () => { setTimeout(() => CurrentFan.collection_count++, 10); throw new Error('onboarding tooltip failed'); };
    assert.equal((await wishlistOpInPage({ op: 'add', id: '1', bandId: '2' })).ok, true);
    uninstallPage();
  });
});
