import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { LIKED_KEY, STATE_KEY } from '../src/lib/storage-keys.js';
import { changeLiked, loadLiked, withSongs } from '../src/lib/liked.js';
import { emptyState } from '../src/lib/state.js';

// A chrome.storage.local that keeps its data in memory (get takes a key or a list of keys, like the real one).
function fakeArea() {
  const data = {};
  return {
    data,
    async get(keys) { const out = {}; for (const key of [].concat(keys)) if (key in data) out[key] = structuredClone(data[key]); return out; },
    async set(items) { for (const [key, value] of Object.entries(items)) data[key] = structuredClone(value); },
  };
}

const song = (id, i, title = `Song ${i}`) => ({ id, i, title });

describe('the Liked Songs list', () => {
  test('withSongs adds, never twice, and removes', () => {
    let list = withSongs([], [song('1', 0), song('1', 1)], true);
    assert.deepEqual(list.map((s) => `${s.id}:${s.i}`), ['1:0', '1:1']);
    list = withSongs(list, [song('1', 0, 'Renamed')], true);
    assert.deepEqual(list.map((s) => `${s.id}:${s.i}:${s.title}`), ['1:1:Song 1', '1:0:Renamed'], 'the same song moves to the end');
    list = withSongs(list, [song('1', 1)], false);
    assert.deepEqual(list.map((s) => `${s.id}:${s.i}`), ['1:0']);
  });

  test('only a whole album is marked, and taking one song out clears the mark', () => {
    let list = withSongs([], [song('1', 0)], true);
    assert.ok(!list.some((s) => s.all), 'a single song does not mark its album');
    list = withSongs(list, [{ ...song('2', 0), all: true }, { ...song('2', 1), all: true }], true);
    assert.deepEqual(list.filter((s) => s.all).map((s) => s.id), ['2', '2']);
    list = withSongs(list, [song('2', 0)], true);
    assert.equal(list.filter((s) => s.all).length, 2, 'adding a song again keeps the mark');
    list = withSongs(list, [song('2', 1)], false);
    assert.ok(!list.some((s) => s.all), 'the album is no longer whole');
  });

  test('a change is written at once under its own key', async () => {
    const area = fakeArea();
    await changeLiked(area, [song('7', 2)], true);
    assert.deepEqual(area.data[LIKED_KEY], [song('7', 2)]);
    assert.equal(STATE_KEY in area.data, false, 'the state is not needed');
  });

  test('the first change starts from the list that an older version kept inside the state', async () => {
    const area = fakeArea();
    await changeLiked(area, [song('2', 0)], true, async () => [song('1', 0)]);
    assert.deepEqual(area.data[LIKED_KEY].map((s) => s.id), ['1', '2']);
  });

  test('changes made at the same time are all kept', async () => {
    const area = fakeArea();
    await Promise.all([1, 2, 3, 4, 5].map((n) => changeLiked(area, [song(String(n), 0)], true)));
    assert.equal((await loadLiked(area)).length, 5);
  });
});

describe('the service worker store never touches the Liked Songs', () => {
  let area;
  let store;
  beforeEach(async () => {
    area = fakeArea();
    globalThis.chrome = { storage: { local: area, session: { set: async () => {}, get: async () => ({}) } } };
    ({ store } = await import(`../src/background/storage.js?${Math.random()}`));
  });

  test('load gives the state the list of its own key', async () => {
    area.data[STATE_KEY] = { ...emptyState(), saved: [song('old', 0)] };
    area.data[LIKED_KEY] = [song('new', 3)];
    assert.deepEqual((await store.load()).saved, [song('new', 3)]);
  });

  test('a state that still holds its own copy moves the list to the separate key, once', async () => {
    area.data[STATE_KEY] = { ...emptyState(), saved: [song('a', 1)] };
    await store.load();
    assert.deepEqual(area.data[LIKED_KEY], [song('a', 1)]);
  });

  test('a run that saves an old copy of the state does not undo what the user liked meanwhile', async () => {
    area.data[STATE_KEY] = { ...emptyState(), saved: [] };
    area.data[LIKED_KEY] = [];
    const state = await store.load();                       // the run starts with the list as it was...
    await changeLiked(area, [song('9', 0)], true);          // ...the user likes a song while it runs...
    await store.save(state);                                // ...and the run saves its (old) copy at the end
    assert.deepEqual(area.data[LIKED_KEY], [song('9', 0)], 'the list of its own key is untouched');
    assert.deepEqual(area.data[STATE_KEY].saved, [song('9', 0)], 'and the state gets the current list');
  });

  test('a state that has to be rebuilt from nothing does not reset the Liked Songs', async () => {
    area.data[LIKED_KEY] = [song('5', 0), song('6', 1)];    // the state is gone (or could not be read), the list is not
    assert.equal(await store.load(), null);
    await store.save(emptyState());                         // what a run does next with a fresh state
    assert.deepEqual(area.data[LIKED_KEY], [song('5', 0), song('6', 1)]);
    assert.deepEqual(area.data[STATE_KEY].saved, [song('5', 0), song('6', 1)]);
  });
});
