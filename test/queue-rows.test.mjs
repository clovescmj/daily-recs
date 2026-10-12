import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { albumQueue, queueWindow, shuffleQueue, startingTrack } from '../src/lib/queue-rows.js';

const album = (n, featured = -1) => Array.from({ length: n }, (_, i) => ({ title: `T${i + 1}`, featured: i === featured }));
const read = (map) => (id) => map[id] || null;

describe('the window of the queue', () => {
  test('the album that plays and the next three; more when the list goes on', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    assert.deepEqual(queueWindow(ids, 'b'), { at: 1, ahead: ['c', 'd', 'e'], more: true });
    assert.deepEqual(queueWindow(ids, 'c'), { at: 2, ahead: ['d', 'e', 'f'], more: false });
  });

  test('an album that is not in the list: the window starts at the top', () => {
    assert.deepEqual(queueWindow(['a', 'b'], 'x'), { at: -1, ahead: ['a', 'b'], more: false });
  });

  test('the starting track is the highlighted one, or the first', () => {
    assert.equal(startingTrack(album(4, 2)), 2);
    assert.equal(startingTrack(album(4)), 0);
  });
});

describe('Full album queue', () => {
  const tracks = { a: album(3), b: album(2), c: album(2), d: album(1) };
  const current = (id, index) => ({ id, index, tracks: tracks[id] });
  const labels = (rows) => rows.map((r) => (r.placeholder ? `${r.id}?` : `${r.id}${r.i}${r.sec[0]}`));

  test('the song that plays, the rest of its album and the songs of the next albums', () => {
    const { rows, more, played } = albumQueue({ order: ['a', 'b', 'c', 'd'], current: current('a', 1), history: [], tracksOf: read(tracks) });
    assert.deepEqual(labels(rows), ['a1n', 'a2n', 'b0n', 'b1n', 'c0n', 'c1n', 'd0n']);
    assert.deepEqual(rows.slice(0, 2).map((r) => r.sec), ['now', 'next']);
    assert.equal(more, false);
    assert.equal(played, 0);
  });

  test('only the next three albums have songs; the note says there are more', () => {
    const order = ['a', 'b', 'c', 'd', 'e'];
    const all = { ...tracks, e: album(2) };
    const { rows, more } = albumQueue({ order, current: current('a', 0), history: [], tracksOf: read(all) });
    assert.equal(rows.some((r) => r.id === 'e'), false);
    assert.equal(more, true);
  });

  test('what played comes first, each song once, and the song that plays is not in it', () => {
    const history = [{ id: 'a', index: 0, title: 'T1' }, { id: 'b', index: 0, title: 'T1' }, { id: 'a', index: 0, title: 'T1' }, { id: 'b', index: 1, title: 'T2' }];
    const { rows } = albumQueue({ order: ['a', 'b', 'c'], current: current('b', 1), history, tracksOf: read(tracks) });
    const played = rows.filter((r) => r.sec === 'played');
    assert.deepEqual(played.map((r) => `${r.id}${r.i}`), ['b0', 'a0']);   // a0 played again: it goes after b0
    assert.equal(rows.find((r) => r.sec === 'now').i, 1);
  });

  test('a song that played in an album whose songs are not read keeps the title it had', () => {
    const history = [{ id: 'z', index: 3, title: 'Old song' }, { id: 'z', index: 4, title: '' }];
    const { rows } = albumQueue({ order: ['a'], current: current('a', 0), history, tracksOf: read(tracks) });
    const z = rows.filter((r) => r.id === 'z');
    assert.deepEqual(z.map((r) => r.title), ['Old song', 'Track 5']);
  });

  test('an album whose songs are not read is one line', () => {
    const { rows } = albumQueue({ order: ['a', 'b', 'x'], current: current('a', 2), history: [], tracksOf: read(tracks) });
    assert.deepEqual(labels(rows), ['a2n', 'b0n', 'b1n', 'x?']);
    assert.equal(rows[3].i, -1);
  });

  test('the album that plays is not in the list: no rows for it, the list from the top', () => {
    const { rows, played } = albumQueue({ order: ['b', 'c'], current: current('a', 0), history: [], tracksOf: read(tracks) });
    assert.deepEqual(labels(rows), ['b0n', 'b1n', 'c0n', 'c1n']);
    assert.equal(played, 0);
  });
});

describe('Shuffle queue', () => {
  const tracks = { a: album(3), b: album(4, 2), c: album(2), d: album(5) };
  const current = (id, index) => ({ id, index, tracks: tracks[id] });
  const rowsOf = ({ order, cur, history = [], pending = [], known = tracks }) => shuffleQueue({ order, current: cur, history, pending: new Map(pending), tracksOf: read(known) }).rows;

  test('the playing album shows its song; the albums after it the highlighted song', () => {
    const rows = rowsOf({ order: ['a', 'b', 'c'], cur: current('a', 1) });
    assert.deepEqual(rows.map((r) => [r.id, r.i, r.title]), [['a', 1, 'T2'], ['b', 2, 'T3'], ['c', 0, 'T1']]);
  });

  test('an album before the playing one shows the song that played from it', () => {
    const history = [{ id: 'a', index: 2, title: 'T3' }];
    const rows = rowsOf({ order: ['a', 'b'], cur: current('b', 0), history });
    assert.deepEqual(rows[0], { id: 'a', i: 2, title: 'T3', named: true });
  });

  test('a song that was already chosen for an album is the one shown (it is the one that plays)', () => {
    const rows = rowsOf({ order: ['a', 'b'], cur: current('a', 0), pending: [['b', 3]] });
    assert.equal(rows[1].title, 'T4');
  });

  test('an album that played in an earlier round and has no song chosen yet is named by its album', () => {
    const history = [{ id: 'c', index: 0, title: 'T1' }];
    const rows = rowsOf({ order: ['a', 'c'], cur: current('a', 0), history });
    assert.deepEqual(rows[1], { id: 'c', i: -1, placeholder: true });
  });

  test('an album whose songs are not read is named by its album, with no song number', () => {
    const rows = rowsOf({ order: ['a', 'x'], cur: current('a', 0) });
    assert.deepEqual(rows[1], { id: 'x', i: -1, placeholder: true });
  });

  test('nothing plays: every album shows the song that will start it; the position is zero', () => {
    const result = shuffleQueue({ order: ['b', 'c'], current: { id: null, index: 0, tracks: [] }, history: [], pending: new Map(), tracksOf: read(tracks) });
    assert.deepEqual(result.rows.map((r) => r.title), ['T3', 'T1']);
    assert.equal(result.played, 0);
    assert.equal(result.more, false);
  });
});
