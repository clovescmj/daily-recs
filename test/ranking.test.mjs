import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, migrateState, rollShownOver } from '../src/lib/state.js';
import { hashSource } from '../src/lib/taste-sync.js';
import { createSourceWeigher } from '../src/lib/taste-profile.js';
import {
  candidateNet, isOwned, markShown, pickBest, pickFocused, pickSources, pickSurprise, score, sourceNet,
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

test('markShown remembers albums and their artists for today; tomorrow they are never shown again', () => {
  const state = stateWith([candidate('3', '6', { s: 1 })]);
  markShown(state, ['3']);
  assert.deepEqual(state.shownToday, ['3']);
  assert.deepEqual(state.shownArtistsToday, ['6']);
  assert.ok(pickBest(state, 1).includes('3'), 'another list of the same day may show it again');
  rollShownOver(state, '2026-10-09');
  assert.deepEqual(state.shown, ['3']);
  assert.deepEqual(state.shownArtists, ['6']);
  assert.deepEqual(pickBest(state, 1), [], 'but not on the next day');
});

describe('pickFocused', () => {
  const album = (n, tags, srcs = { s: 1 }) => ({ id: String(n), artistId: `a${n}`, title: `T${n}`, artist: `A${n}`, url: `https://c.bandcamp.com/album/${n}`, srcs, tags });
  test('keeps albums of the chosen genres, more matching tags first, then albums whose tags are unknown', () => {
    const state = stateWith([
      album(1, ['pop'], { s: 9, t: 9 }), album(2, ['metal'], { s: 1 }), album(3, ['metal', 'doom'], { s: 1 }),
      album(4, undefined, { s: 1 }), album(5, ['doom'], { s: 2 }),
    ]);
    assert.deepEqual(pickFocused(state, 10, ['metal', 'doom']), ['3', '5', '2', '4']);
    assert.ok(!pickFocused(state, 10, ['metal']).includes('1'), 'an album of another genre is never picked');
  });
  test('one album per artist', () => {
    const state = stateWith([album(1, ['metal']), { ...album(2, ['metal']), artistId: 'a1' }]);
    assert.equal(pickFocused(state, 10, ['metal']).length, 1);
  });
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

  test('"don\'t show music like this": the artist of a hidden album and the albums Bandcamp pairs with it do not come back', () => {
    const state = stateWith([candidate('a', 'x', { u: 3 }), candidate('b', 'y', { u: 3 }), candidate('c', 'z', { u: 3 }), candidate('d', 'x', { u: 3 })]);
    assert.equal(pickBest(state, 4).length, 4);
    state.avoid = { 99: { artistId: 'x', near: ['b'] } };
    assert.deepEqual(pickBest(state, 4), ['c'], 'the artist x and the neighbour b are out');
  });

  test('in a genre list, an album recommended by more of the user\'s albums comes first', () => {
    const one = { ...candidate('a', 'a', { u: 3 }), tags: ['ebm'] };
    const three = { ...candidate('b', 'b', { u: 3, v: 3, w: 3 }), tags: ['ebm'] };
    const state = stateWith([one, three]);
    assert.deepEqual(pickFocused(state, 2, ['ebm']), ['b', 'a']);
  });

  test('pickSources never picks pages the extension cannot read (labels on their own domain)', () => {
    const state = emptyState();
    state.owned = { ...owned, sources: [
      { url: 'https://listen.20buckspin.com/album/x', title: 'T', artist: 'A' },
      { url: 'https://ok.bandcamp.com/album/y', title: 'U', artist: 'B' },
    ] };
    assert.deepEqual(pickSources(state, 5).map((s) => s.url), ['https://ok.bandcamp.com/album/y']);
  });

  test('pickSources keeps at most two albums per artist', () => {
    const state = emptyState();
    state.owned = { ...owned, sources: Array.from({ length: 20 }, (_, i) => ({ url: `https://s${i}.bandcamp.com/a`, title: `T${i}`, artist: i < 10 ? 'same artist' : `artist ${i}` })) };
    const picked = pickSources(state, 20);
    assert.ok(picked.filter((s) => s.artist === 'same artist').length <= 2);
  });
});

describe('lists stay in proportion to the user taste', () => {
  const album = (n, tags, srcs) => ({ id: String(n), artistId: `a${n}`, title: `T${n}`, artist: `A${n}`, url: `https://c.bandcamp.com/album/${n}`, srcs, tags });

  function crowdedState() {
    const state = stateWith([]);
    state.tasteTags = { electronic: 50, industrial: 40, ebm: 30, darkwave: 8 };      // darkwave is a small part of this library
    for (let i = 0; i < 100; i++) state.sampled[`https://s${i}.bandcamp.com/a`] = 1; // 100 albums were read
    // 25 darkwave albums that Bandcamp recommends a lot (they rank first), then 40 albums of the user's main genres
    for (let i = 0; i < 25; i++) state.pool[`d${i}`] = album(`d${i}`, ['darkwave', 'electronic'], { s1: 9, s2: 9, s3: 9 });
    for (let i = 0; i < 40; i++) state.pool[`m${i}`] = album(`m${i}`, i % 2 ? ['industrial', 'electronic'] : ['ebm', 'electronic'], { s1: 3 });
    return state;
  }
  const withTag = (state, ids, tag) => ids.filter((id) => state.pool[id].tags.includes(tag)).length;

  test('a small genre does not take over the list, even when it ranks first', () => {
    const state = crowdedState();
    const picks = pickBest(state, 30);
    assert.equal(picks.length, 30);
    assert.ok(withTag(state, picks, 'darkwave') <= 5, `darkwave: ${withTag(state, picks, 'darkwave')}`);
  });

  test('the limit is relaxed instead of returning a short list', () => {
    const state = stateWith([]);
    state.tasteTags = { electronic: 50, darkwave: 8 };
    for (let i = 0; i < 100; i++) state.sampled[`https://s${i}.bandcamp.com/a`] = 1;
    for (let i = 0; i < 10; i++) state.pool[`d${i}`] = album(`d${i}`, ['darkwave'], { s1: 3 });
    assert.equal(pickBest(state, 8).length, 8);
  });

  test('without a taste profile nothing is limited', () => {
    const state = stateWith([]);
    for (let i = 0; i < 10; i++) state.pool[`d${i}`] = album(`d${i}`, ['darkwave'], { s1: 3 });
    assert.equal(pickBest(state, 8).length, 8);
  });

  test('stored profiles merge old spellings of the same tag', () => {
    const state = emptyState();
    state.tasteTags = { 'e.b.m': 6, ebm: 29, 'electronic body music': 4, 'dark wave': 2, darkwave: 8 };
    migrateState(state);
    assert.equal(state.tasteTags.ebm, 39);
    assert.equal(state.tasteTags.darkwave, 10);
    assert.equal(Object.keys(state.tasteTags).length, 2);
  });
});
