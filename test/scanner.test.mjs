import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanSources } from '../src/lib/scanner.js';
import { knownTags, recordSourceRead, scanProgress, selectableTags, tagsOfAlbum, unscannedSources } from '../src/lib/taste-profile.js';
import { emptyState } from '../src/lib/state.js';
import { loadLibrary } from '../src/lib/bandcamp.js';
import { createFakeBandcamp } from './helpers/fake-bandcamp.js';

const FAST = { delayMs: 0, retryDelayMs: 1, pageDelayMs: 0 };

async function setup(options) {
  const fake = createFakeBandcamp({ libraryCount: 30, wishlistCount: 10, ...options });
  const state = emptyState();
  state.owned = await loadLibrary(fake.fetch, fake.profileUrl, FAST);
  return { fake, state };
}

describe('background scan', () => {
  test('reads a few albums at a time and records their tags, one album at a time', async () => {
    const { fake, state } = await setup({ sourceTags: (n) => (n % 2 ? ['metal', 'doom'] : ['Noise'.toLowerCase(), 'metal']) });
    const first = await scanSources({ fetch: fake.fetch, state, count: 8, tuning: FAST });
    assert.equal(first.read, 8);
    assert.deepEqual(first.progress, { scanned: 8, total: 40 });
    assert.equal(scanProgress(state).scanned, 8);
    const second = await scanSources({ fetch: fake.fetch, state, count: 8, tuning: FAST });
    assert.equal(second.read, 8);
    assert.equal(scanProgress(state).scanned, 16, 'it carries on where it stopped, never re-reading albums');
    assert.equal(fake.calls.filter((c) => /src\d+/.test(c.url)).length, 16);
  });

  test('finishes the whole library and then has nothing left to do', async () => {
    const { fake, state } = await setup({ sourceTags: () => ['metal'] });
    for (let i = 0; i < 6; i++) await scanSources({ fetch: fake.fetch, state, count: 8, tuning: FAST });
    assert.deepEqual(scanProgress(state), { scanned: 40, total: 40 });
    assert.equal((await scanSources({ fetch: fake.fetch, state, tuning: FAST })).read, 0);
    assert.equal(unscannedSources(state, 5).length, 0);
  });

  test('lists the genres found, most common first, with readable names', async () => {
    const { fake, state } = await setup({ sourceTags: (n) => (n < 10000 ? ['metal', n % 2 ? 'e.b.m' : 'ebm'] : ['electronic body music', 'post-punk']) });
    for (let i = 0; i < 6; i++) await scanSources({ fetch: fake.fetch, state, count: 8, tuning: FAST });
    const tags = knownTags(state);
    assert.deepEqual(tags.map((t) => t.key), ['ebm', 'metal', 'postpunk']);
    assert.equal(tags[0].count, 40, 'both spellings of EBM count as one genre');
    assert.deepEqual(tags.map((t) => t.label), ['ebm', 'metal', 'post-punk']);
    assert.deepEqual(knownTags(state, 35).map((t) => t.key), ['ebm']);
  });

  test('an album is counted in the genre profile only once, however it was read', () => {
    const state = emptyState();
    const tags = [{ key: 'metal', label: 'metal' }];
    recordSourceRead(state, 'https://a.bandcamp.com/album/x', tags, 1);
    recordSourceRead(state, 'https://a.bandcamp.com/album/x', tags, 1);
    assert.equal(state.tasteTags.metal, 1);
    state.sampled['https://b.bandcamp.com/album/y'] = 1; // read before this version: already in the profile
    recordSourceRead(state, 'https://b.bandcamp.com/album/y', tags, 1);
    assert.equal(state.tasteTags.metal, 1);
    assert.deepEqual(tagsOfAlbum(state, 'https://b.bandcamp.com/album/y'), ['metal']);
  });

  test('does not read pages it is not allowed to read (labels on their own domain)', async () => {
    const { fake, state } = await setup();
    state.owned.sources.push({ url: 'https://listen.20buckspin.com/album/x', title: 'x', artist: 'y' });
    await scanSources({ fetch: fake.fetch, state, count: 100, tuning: FAST });
    assert.ok(!fake.calls.some((c) => /20buckspin/.test(c.url)));
    assert.equal(scanProgress(state).total, 40, 'and it is not counted in the total');
  });

  test('rests for half an hour when Bandcamp asks to slow down', async () => {
    const { fake, state } = await setup();
    fake.failures.push({ match: /src\d+\.bandcamp\.com/, status: 429 });
    const now = 1_000_000;
    const result = await scanSources({ fetch: fake.fetch, state, count: 8, now, tuning: FAST });
    assert.equal(result.read, 0);
    assert.equal(state.scanPausedUntil, now + 30 * 60 * 1000);
    fake.failures.length = 0;
    assert.equal((await scanSources({ fetch: fake.fetch, state, now: now + 1000, tuning: FAST })).paused, true);
    assert.equal((await scanSources({ fetch: fake.fetch, state, now: now + 31 * 60 * 1000, count: 4, tuning: FAST })).read, 4);
  });

  test('an album that no longer exists is marked as scanned instead of being retried forever', async () => {
    const { fake, state } = await setup();
    fake.failures.push({ match: /src0\.bandcamp\.com/, status: 404 });
    for (let i = 0; i < 6; i++) await scanSources({ fetch: fake.fetch, state, count: 8, tuning: FAST });
    assert.deepEqual(scanProgress(state), { scanned: 40, total: 40 });
  });
});

describe('which tags are offered as genres', () => {
  // Builds a library of albums: [url, artist, tags...]
  function library(albums) {
    const state = emptyState();
    state.owned = { sources: albums.map(([url, artist]) => ({ url, title: 't', artist })) };
    for (const [url, , ...tags] of albums) recordSourceRead(state, url, tags.map((key) => ({ key, label: key })), 1);
    return state;
  }
  const offered = (state) => selectableTags(state).map((tag) => tag.key);

  test('real genres are offered, most common first', () => {
    const state = library([
      ['https://a.bandcamp.com/album/1', 'Alpha', 'metal', 'doom'], ['https://b.bandcamp.com/album/2', 'Beta', 'metal'],
      ['https://c.bandcamp.com/album/3', 'Gamma', 'doom', 'metal'],
    ]);
    assert.deepEqual(offered(state), ['metal', 'doom']);
  });

  test('formats, years and generic words are not genres', () => {
    const state = library([
      ['https://a.bandcamp.com/album/1', 'A', 'doom', 'cassette', '2023', 'limited'], ['https://b.bandcamp.com/album/2', 'B', 'doom', 'cassette', '2023', 'limited'],
    ]);
    assert.deepEqual(offered(state), ['doom']);
  });

  test('the name of the label or artist that released the albums is not a genre', () => {
    const state = library([
      ['https://complexrecords.bandcamp.com/album/1', 'Complex Records', 'ebm', 'complex'], ['https://complexrecords.bandcamp.com/album/2', 'Complex Records', 'ebm', 'complex'],
      ['https://someartist.bandcamp.com/album/3', 'Some Artist', 'ebm', 'complex'],
    ]);
    assert.deepEqual(offered(state), ['ebm']);
  });

  test('a genre that happens to be part of one account name is still a genre', () => {
    const state = library([
      ['https://technoclub.bandcamp.com/album/1', 'Techno Club', 'techno'], ['https://x.bandcamp.com/album/2', 'X', 'techno'],
      ['https://y.bandcamp.com/album/3', 'Y', 'techno'], ['https://z.bandcamp.com/album/4', 'Z', 'techno'],
    ]);
    assert.deepEqual(offered(state), ['techno']);
  });

  test('a tag that is never among the first ones on a page is not treated as a genre', () => {
    const state = library([
      ['https://a.bandcamp.com/album/1', 'A', 'noise', 'drone', 'doom', 'punk', 'sideproject'], ['https://b.bandcamp.com/album/2', 'B', 'noise', 'drone', 'doom', 'punk', 'sideproject'],
    ]);
    assert.deepEqual(offered(state).sort(), ['doom', 'drone', 'noise']);
  });

  test('junk is not offered: lists of hashtags, places, typos and names that only two albums share', () => {
    const state = library([
      ['https://a.bandcamp.com/album/1', 'A', 'ebm', 'punk#ebm#lofi#postpunk', 'tbilisi', 'khidi', 'othr'],
      ['https://b.bandcamp.com/album/2', 'B', 'ebm', 'punk#ebm#lofi#postpunk', 'tbilisi', 'khidi', 'othr'],
      ['https://c.bandcamp.com/album/3', 'C', 'ebm', 'punk#ebm#lofi#postpunk'],
    ]);
    assert.deepEqual(offered(state), ['ebm']);
  });

  test('a tag that is not a known genre is offered once it is clearly common in the library', () => {
    const albums = ['1', '2', '3', '4'].map((n) => [`https://x${n}.bandcamp.com/album/${n}`, `X${n}`, 'witchy', 'ebm']);
    assert.deepEqual(offered(library(albums)).sort(), ['ebm', 'witchy']);
    assert.deepEqual(offered(library(albums.slice(0, 3))), ['ebm']);
  });

  test('a tag found on a single album is not offered, but stays in the taste profile', () => {
    const state = library([['https://a.bandcamp.com/album/1', 'A', 'doom', 'rareone'], ['https://b.bandcamp.com/album/2', 'B', 'doom']]);
    assert.deepEqual(offered(state), ['doom']);
    assert.equal(state.tasteTags.rareone, 1);
  });
});
