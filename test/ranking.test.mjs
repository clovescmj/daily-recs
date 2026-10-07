import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../src/lib/state.js';
import { hashSource } from '../src/lib/taste-sync.js';
import { createSourceWeigher } from '../src/lib/taste-profile.js';
import {
  candidateNet, isOwned, markShown, pickBest, pickSources, pickSurprise, score, sourceNet,
} from '../src/lib/ranking.js';

const candidate = (id, artistId, srcs) => ({ id, artistId, title: `T${id}`, artist: `A${artistId}`, url: `https://c.bandcamp.com/album/${id}`, srcs });
const owned = { ids: ['1'], bandIds: ['9'], urls: ['https://owned.bandcamp.com/x'], sources: [] };

function stateWith(candidates) {
  const state = emptyState();
  state.owned = { ...owned };
  for (const c of candidates) state.pool[c.id] = c;
  return state;
}

describe('ownership', () => {
  test('matches by album id, by artist, and by URL', () => {
    assert.ok(isOwned({ id: '1', artistId: '5', url: 'u' }, owned));
    assert.ok(isOwned({ id: '2', artistId: '9', url: 'u' }, owned));
    assert.ok(isOwned({ id: '3', artistId: '5', url: 'https://owned.bandcamp.com/x' }, owned));
    assert.ok(!isOwned({ id: '4', artistId: '5', url: 'u' }, owned));
  });
});

describe('scoring and the taste thermometer', () => {
  const state = emptyState();
  const a = candidate('10', '1', { s1: 5, s2: 3 });
  const b = candidate('11', '2', { s3: 5 });

  test('more sources score higher', () => assert.ok(score(a, state) > score(b, state)));

  test('likes raise and dislikes lower the sources of a candidate', () => {
    const tuned = emptyState();
    tuned.sourceLikes[hashSource('s3')] = 3;
    assert.equal(sourceNet(tuned, 's3'), 3);
    assert.ok(score(b, tuned) > score(b, state));
    tuned.sourceDislikes[hashSource('s3')] = 5;
    assert.equal(candidateNet(b, tuned), -2);
    assert.ok(score(b, tuned) < score(b, state));
  });
});

describe('pickBest', () => {
  test('excludes owned, shown, liked and disliked albums and takes one per artist', () => {
    const state = stateWith([
      candidate('1', '5', { s: 9 }),                  // owned id
      candidate('2', '9', { s: 9 }),                  // owned artist
      candidate('3', '6', { s: 9, t: 9, u: 9 }),      // best
      candidate('4', '6', { s: 9 }),                  // same artist as 3 -> skipped while there are alternatives
      candidate('5', '7', { s: 9, t: 9 }),
      candidate('6', '8', { s: 9 }),                  // shown
      candidate('7', '10', { s: 9 }),                 // disliked
    ]);
    state.shown = ['6']; state.dismissed = ['7'];
    assert.deepEqual(pickBest(state, 2), ['3', '5']);
  });

  test('completes with a repeated artist only when it has to', () => {
    const state = stateWith([candidate('3', '6', { s: 9, t: 9 }), candidate('4', '6', { s: 9 })]);
    assert.deepEqual(pickBest(state, 2), ['3', '4']);
  });
});

describe('pickSurprise', () => {
  test('stays away from the top and from sources the thermometer rejected', () => {
    const state = stateWith(Array.from({ length: 12 }, (_, i) => candidate(String(100 + i), String(200 + i), { [`s${i}`]: 1, ...(i < 3 ? { shared: 5, shared2: 5 } : {}) })));
    state.sourceDislikes[hashSource('s11')] = 4; // the weakest candidate comes from a rejected source
    const picks = pickSurprise(state, 3);
    assert.equal(picks.length, 3);
    assert.ok(!picks.includes('111'), 'rejected source excluded');
    assert.ok(picks.every((id) => state.pool[id].surprise === true));
  });
});

describe('pickSources', () => {
  const source = (n) => ({ url: `https://s${n}.bandcamp.com/album/x`, title: `S${n}`, artist: `artist ${n}` });

  test('never reads sources that produced lots of dislikes, and reads unread ones first', () => {
    const state = emptyState();
    state.owned = { ...owned, sources: Array.from({ length: 10 }, (_, i) => source(i)) };
    state.sourceDislikes[hashSource(source(0).url)] = 5;
    for (let i = 1; i < 5; i++) state.sampled[source(i).url] = Date.now();
    const picked = pickSources(state, 5);
    assert.ok(!picked.some((s) => s.url === source(0).url));
    assert.deepEqual(new Set(picked.map((s) => s.url)), new Set([5, 6, 7, 8, 9].map((i) => source(i).url)));
  });

  test('liked albums become sources, and sources that produced likes get priority slots', () => {
    const state = emptyState();
    state.owned = { ...owned, sources: Array.from({ length: 30 }, (_, i) => source(i)) };
    state.pool['77'] = { id: '77', title: 'Liked', artist: 'x', url: 'https://liked.bandcamp.com/album/z', srcs: {} };
    state.liked = ['77'];
    state.sourceLikes[hashSource(source(4).url)] = 2;
    const picked = pickSources(state, 10);
    assert.equal(picked[0].url, 'https://liked.bandcamp.com/album/z');
    assert.ok(picked.some((s) => s.url === source(4).url));
  });
});

test('markShown remembers albums and their artists', () => {
  const state = stateWith([candidate('3', '6', { s: 1 })]);
  markShown(state, ['3']);
  assert.deepEqual(state.shown, ['3']);
  assert.deepEqual(state.shownArtists, ['6']);
});

describe('how much each album counts', () => {
  const src = (n, extra = {}) => ({ url: `https://s${n}.bandcamp.com/album/x`, title: `S${n}`, artist: `artist ${n}`, ...extra });

  test('saved albums count a little less than purchases, and recent ones more than old ones', () => {
    const state = emptyState();
    state.owned = { ...owned, sources: [src(1, { kind: 'collection', recent: 1 }), src(2, { kind: 'wishlist', recent: 1 }), src(3, { kind: 'collection', recent: 0 })] };
    const weigh = createSourceWeigher(state);
    assert.ok(weigh(src(2).url) < weigh(src(1).url), 'saved < purchased');
    assert.ok(weigh(src(2).url) > 0.7 * weigh(src(1).url), 'but only a little');
    assert.ok(weigh(src(3).url) < weigh(src(1).url), 'old < recent');
    assert.ok(weigh(src(3).url) >= 0.7, 'old items still count');
  });

  test('albums liked in the extension count the most', () => {
    const state = emptyState();
    state.owned = { ...owned, sources: [src(1, { kind: 'collection', recent: 1 }), src(2, { kind: 'wishlist', recent: 1 })] };
    state.pool['9'] = { id: '9', url: src(2).url };
    state.liked = ['9'];
    const weigh = createSourceWeigher(state);
    assert.ok(weigh(src(2).url) > weigh(src(1).url));
  });

  test('more fans in common raise the score', () => {
    const state = stateWith([]);
    const few = { id: 'a', artistId: 'a', url: 'a', srcs: { u: 2 } };
    const many = { id: 'b', artistId: 'b', url: 'b', srcs: { u: 40 } };
    assert.ok(score(many, state) > score(few, state));
  });

  test('tags: a fitting album outranks an unrelated one with the same sources, and dislikes never touch tags', () => {
    const state = stateWith([]);
    state.tasteTags = { metal: 5, noise: 3 };
    const fitting = { id: 'a', artistId: 'a', url: 'a', srcs: { u: 3 }, tags: ['metal'] };
    const unrelated = { id: 'b', artistId: 'b', url: 'b', srcs: { u: 3 }, tags: ['schlager'] };
    assert.ok(score(fitting, state) > score(unrelated, state));
    const before = { ...state.tasteTags };
    state.sourceDislikes.x = 3;
    assert.deepEqual(state.tasteTags, before);
  });

  test('pickSources keeps at most two albums per artist', () => {
    const state = emptyState();
    state.owned = { ...owned, sources: Array.from({ length: 20 }, (_, i) => ({ url: `https://s${i}.bandcamp.com/a`, title: `T${i}`, artist: i < 10 ? 'same artist' : `artist ${i}` })) };
    const picked = pickSources(state, 20);
    assert.ok(picked.filter((s) => s.artist === 'same artist').length <= 2);
  });
});
