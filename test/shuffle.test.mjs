import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createShuffler } from '../src/pages/recs/shuffle.js';

// Plays the way the page does: pick an album, "read" it (learn its real size), pick a track, mark it played.
function playOne(shuffler, albums) {
  for (let tries = 0; tries < 20; tries++) {
    const id = shuffler.pickAlbum(Object.keys(albums));
    shuffler.setTrackCount(id, albums[id]);
    const index = shuffler.pickTrack(id, albums[id]);
    if (index === null) continue;
    shuffler.markPlayed(id, index);
    return `${id}:${index}`;
  }
  throw new Error('nothing to play');
}

describe('shuffle', () => {
  const albums = { a: 3, b: 12, c: 1, d: 8, e: 5 };          // 29 tracks in total, sizes unknown to the shuffler at first
  const total = Object.values(albums).reduce((sum, n) => sum + n, 0);

  test('plays every track of every album exactly once before repeating anything', () => {
    for (let run = 0; run < 50; run++) {
      const shuffler = createShuffler();
      const round = Array.from({ length: total }, () => playOne(shuffler, albums));
      assert.equal(new Set(round).size, total, 'no track repeated inside the round');
      const expected = Object.entries(albums).flatMap(([id, n]) => Array.from({ length: n }, (_, i) => `${id}:${i}`));
      assert.deepEqual([...round].sort(), expected.sort(), 'and none missing');
    }
  });

  test('then starts a new round', () => {
    const shuffler = createShuffler();
    for (let i = 0; i < total; i++) playOne(shuffler, albums);
    const next = Array.from({ length: total }, () => playOne(shuffler, albums));
    assert.equal(new Set(next).size, total);
  });

  test('the order is really random (not album by album)', () => {
    const shuffler = createShuffler();
    const order = Array.from({ length: total }, () => playOne(shuffler, albums)).map((t) => t.split(':')[0]);
    const switches = order.filter((id, i) => i > 0 && id !== order[i - 1]).length;
    assert.ok(switches > total / 3, `album changes ${switches} times in ${total} tracks`);
  });

  test('a track that was already playing when shuffle started is not played again in that round', () => {
    const shuffler = createShuffler();
    shuffler.setTrackCount('a', 3);
    shuffler.markPlayed('a', 1);
    const round = Array.from({ length: total - 1 }, () => playOne(shuffler, albums));
    assert.ok(!round.includes('a:1'));
    assert.equal(new Set(round).size, total - 1);
  });

  test('albums that were removed from the list (ids not offered) are never picked', () => {
    const shuffler = createShuffler();
    for (let i = 0; i < 40; i++) {
      const id = shuffler.pickAlbum(['a', 'c']);
      assert.ok(['a', 'c'].includes(id));
      shuffler.setTrackCount(id, albums[id]);
      const index = shuffler.pickTrack(id, albums[id]);
      if (index !== null) shuffler.markPlayed(id, index);
    }
  });

  test('returns null with no albums', () => assert.equal(createShuffler().pickAlbum([]), null));
});
