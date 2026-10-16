import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { QUEUE_MAX_NEXT, playbackQueue, startingTrack } from '../src/lib/queue-rows.js';

const songs = { a: { i: 0, title: 'A song' }, b: { i: 2, title: 'B song' }, c: { i: 0, title: 'C song' }, d: null };
const songOf = (id) => songs[id] || null;
const labels = (rows) => rows.map((r) => (r.placeholder ? `${r.id}?` : `${r.id}${r.i}${r.sec[0]}${r.liked ? 'L' : ''}`));

describe('the starting track', () => {
  test('the highlighted song, or the first', () => {
    assert.equal(startingTrack([{}, { featured: true }, {}]), 1);
    assert.equal(startingTrack([{}, {}]), 0);
  });
});

describe('the queue of the list', () => {
  test('the song that plays, and the cards after it in the order of the page', () => {
    const { rows, played, total, more } = playbackQueue({
      order: ['a', 'b', 'c', 'd'], cursorId: 'b', current: { id: 'b', index: 2, title: 'B song' }, history: [], songOf,
    });
    assert.deepEqual(labels(rows), ['b2n', 'c0n', 'd?']);
    assert.deepEqual({ played, total, more }, { played: 2, total: 4, more: false });
  });

  test('what played comes first, each song once, and the song that plays is not in it', () => {
    const history = [{ id: 'a', index: 0, title: 'A song' }, { id: 'b', index: 2, title: 'B song' }, { id: 'a', index: 0, title: 'A song' }, { id: 'c', index: 0, title: 'C song' }];
    const { rows } = playbackQueue({ order: ['a', 'b', 'c', 'd'], cursorId: 'c', current: { id: 'c', index: 0, title: 'C song' }, history, songOf });
    assert.deepEqual(labels(rows).filter((l) => l.endsWith('p')), ['b2p', 'a0p']);   // a played again: it goes after b
    assert.deepEqual(labels(rows).slice(-2), ['c0n', 'd?']);
  });

  test('a song played from Liked Songs does not move where the list goes on from', () => {
    const { rows, played } = playbackQueue({
      order: ['a', 'b', 'c'], cursorId: 'a', current: { id: 'z', index: 4, title: 'Liked one' }, history: [], songOf,
    });
    assert.deepEqual(labels(rows), ['z4n', 'b2n', 'c0n']);
    assert.equal(played, 1);
  });

  test('nothing plays yet: the whole list, from the top', () => {
    const { rows } = playbackQueue({ order: ['a', 'b'], cursorId: null, current: { id: null, index: 0 }, history: [], songOf });
    assert.deepEqual(labels(rows), ['a0n', 'b2n']);
  });

  test('only the next rows up to the limit are drawn, and it says there are more', () => {
    const ids = Array.from({ length: QUEUE_MAX_NEXT + 20 }, (_, n) => `x${n}`);
    const { rows, more } = playbackQueue({ order: ids, cursorId: 'x0', current: { id: 'x0', index: 0, title: 't' }, history: [], songOf: () => ({ i: 0, title: 's' }) });
    assert.equal(rows.filter((r) => r.sec === 'next').length, QUEUE_MAX_NEXT);
    assert.equal(more, true);
  });
});

describe('the queue of Liked Songs', () => {
  const liked = [{ id: 'z', i: 1, title: 'First liked' }, { id: 'y', i: 0, title: 'Second liked' }, { id: 'x', i: 3, title: 'Third liked' }];

  test('the Liked Songs after the song that plays, in the order of their list', () => {
    const { rows, total } = playbackQueue({
      context: 'liked', order: ['a', 'b'], cursorId: 'a', current: { id: 'z', index: 1, title: 'First liked' }, history: [], songOf, liked,
    });
    assert.deepEqual(labels(rows), ['z1n', 'y0nL', 'x3nL']);
    assert.equal(total, 3);
  });

  test('at the last Liked Song there is nothing after it', () => {
    const { rows } = playbackQueue({
      context: 'liked', order: ['a'], cursorId: 'a', current: { id: 'x', index: 3, title: 'Third liked' }, history: [], songOf, liked,
    });
    assert.deepEqual(labels(rows), ['x3n']);
  });
});
