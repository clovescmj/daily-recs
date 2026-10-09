import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpError, NotLoggedInError, RateLimitedError, fetchText, getFan, loadLibrary, parseRecommendations, parseTracks,
  toHttpsUrl, toNumericId, decodeHtmlEntities,
} from '../src/lib/bandcamp.js';
import { createFakeBandcamp } from './helpers/fake-bandcamp.js';

const FAST = { baseDelayMs: 1, pageDelayMs: 0 };
const response = (status, body = '') => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, text: async () => body, json: async () => JSON.parse(body || '{}') });

describe('sanitising', () => {
  test('toHttpsUrl only accepts https URLs', () => {
    assert.equal(toHttpsUrl('https://a.bandcamp.com/album/x'), 'https://a.bandcamp.com/album/x');
    assert.equal(toHttpsUrl('http://a.bandcamp.com/x'), '');
    assert.equal(toHttpsUrl('javascript:alert(1)'), '');
    assert.equal(toHttpsUrl('//evil.example/x'), '');
    assert.equal(toHttpsUrl('not a url'), '');
  });

  test('toNumericId only accepts digits', () => {
    assert.equal(toNumericId('12345'), '12345');
    assert.equal(toNumericId(987), '987');
    for (const bad of ['12a', '', null, undefined, '1"onmouseover="x', '-1', '1.5']) assert.equal(toNumericId(bad), '');
  });

  test('decodeHtmlEntities handles named and numeric entities', () => {
    assert.equal(decodeHtmlEntities('a &amp; b &quot;c&quot; &#39;d&#39; &#x41;&#66;'), 'a & b "c" \'d\' AB');
  });
});

describe('parseRecommendations', () => {
  const item = (attrs, body) => `<li class="recommended-album footer-cc" ${attrs}>${body}</li>`;
  const good = item('data-albumid="111" data-albumtitle="Title &amp; Co" data-artist="Artist" data-artistid="222"',
    '<img class="album-art" src="https://f4.bcbits.com/img/a1.jpg"><a href="https://x.bandcamp.com/album/y?from=footer">go</a>'
    + '<p>supported by 13 fans who also own “Some Album”</p>');

  test('extracts every field and strips the query string', () => {
    const [rec] = parseRecommendations(good);
    assert.deepEqual(rec, {
      id: '111', title: 'Title & Co', artist: 'Artist', artistId: '222', url: 'https://x.bandcamp.com/album/y',
      art: 'https://f4.bcbits.com/img/a1.jpg', fans: 13, ownedTitle: 'Some Album',
    });
  });

  test('drops entries with a non-numeric id or a non-https URL (untrusted HTML)', () => {
    const evilId = item('data-albumid="1&quot; onclick=&quot;x" data-albumtitle="t" data-artist="a" data-artistid="2"', '<a href="https://x.bandcamp.com/a">go</a>');
    const evilUrl = item('data-albumid="5" data-albumtitle="t" data-artist="a" data-artistid="2"', '<a href="javascript:alert(1)">go</a>');
    assert.deepEqual(parseRecommendations(evilId + evilUrl), []);
  });

  test('neutralises a non-https cover image', () => {
    const html = item('data-albumid="5" data-albumtitle="t" data-artist="a" data-artistid="2"',
      '<img class="album-art" src="javascript:x"><a href="https://x.bandcamp.com/a">go</a>');
    assert.equal(parseRecommendations(html)[0].art, '');
  });

  test('caps absurdly long titles', () => {
    const html = item(`data-albumid="5" data-albumtitle="${'x'.repeat(5000)}" data-artist="a" data-artistid="2"`, '<a href="https://x.bandcamp.com/a">go</a>');
    assert.equal(parseRecommendations(html)[0].title.length, 300);
  });
});

describe('parseTracks', () => {
  const page = (tracks, featured) => `<div data-tralbum="${JSON.stringify({ trackinfo: tracks, featured_track_id: featured }).replace(/"/g, '&quot;')}"></div>`;

  test('returns streamable tracks only, with https sources', () => {
    const tracks = parseTracks(page([
      { title: 'ok', file: { 'mp3-128': 'https://t4.bcbits.com/stream/x' }, duration: 10 },
      { title: 'no file' },
      { title: 'bad scheme', file: { 'mp3-128': 'http://t4.bcbits.com/stream/x' } },
    ]));
    assert.deepEqual(tracks.map((t) => t.title), ['ok']);
  });

  test('keeps the address of each song\'s own page', () => {
    const tracks = parseTracks(page([
      { title: 'a', title_link: '/track/a', file: { 'mp3-128': 'https://t4.bcbits.com/stream/a' } },
      { title: 'b', file: { 'mp3-128': 'https://t4.bcbits.com/stream/b' } },
    ]));
    assert.deepEqual(tracks.map((t) => t.link), ['/track/a', '']);
  });

  test('marks the track the artist chose to highlight', () => {
    const file = (n) => ({ 'mp3-128': `https://t4.bcbits.com/stream/${n}` });
    const tracks = parseTracks(page([
      { track_id: 11, title: 'one', file: file(1) }, { track_id: 22, title: 'two', file: file(2) }, { track_id: 33, title: 'three', file: file(3) },
    ], 22));
    assert.deepEqual(tracks.map((t) => t.featured), [false, true, false]);
    assert.ok(parseTracks(page([{ track_id: 11, title: 'one', file: file(1) }])).every((t) => t.featured === false), 'no featured track set');
  });

  test('returns an empty list when the page has no track data', () => assert.deepEqual(parseTracks('<html></html>'), []));
});

describe('HTTP retry policy', () => {
  test('retries 5xx and then succeeds', async () => {
    const answers = [response(503), response(502), response(200, 'hello')];
    assert.equal(await fetchText(async () => answers.shift(), 'https://x', FAST), 'hello');
  });

  test('does not retry other 4xx (a 404 will not fix itself)', async () => {
    let calls = 0;
    await assert.rejects(fetchText(async () => { calls++; return response(404); }, 'https://x', FAST), (e) => e instanceof HttpError && e.status === 404);
    assert.equal(calls, 1);
  });

  test('retries 429 and finally reports rate limiting', async () => {
    let calls = 0;
    await assert.rejects(fetchText(async () => { calls++; return response(429); }, 'https://x', { ...FAST, retries: 2 }), RateLimitedError);
    assert.equal(calls, 3);
  });

  test('retries network errors and rethrows the last one', async () => {
    let calls = 0;
    await assert.rejects(fetchText(async () => { calls++; throw new TypeError('offline'); }, 'https://x', { ...FAST, retries: 2 }), TypeError);
    assert.equal(calls, 3);
  });
});

describe('getFan', () => {
  test('returns the profile URL of the signed-in fan', async () => {
    const fan = await getFan(async () => ({ json: async () => ({ fan_id: 42, collection_summary: { url: 'https://bandcamp.com/me' } }) }));
    assert.deepEqual(fan, { fanId: '42', profileUrl: 'https://bandcamp.com/me' });
  });

  test('throws NotLoggedInError when Bandcamp says nobody is signed in', async () => {
    await assert.rejects(getFan(async () => ({ json: async () => ({ error: true }) })), NotLoggedInError);
  });

  test('rejects a profile URL that is not https', async () => {
    await assert.rejects(getFan(async () => ({ json: async () => ({ fan_id: 1, collection_summary: { url: 'http://evil.example/me' } }) })), NotLoggedInError);
  });
});

describe('loadLibrary', () => {
  test('reads every page of the collection and the wishlist and de-duplicates', async () => {
    const fake = createFakeBandcamp({ libraryCount: 250, wishlistCount: 130 });
    const library = await loadLibrary(fake.fetch, fake.profileUrl, FAST);
    assert.equal(library.collectionCount, 250);
    assert.equal(library.wishlistCount, 130);
    assert.equal(library.sources.length, 380);
    assert.equal(new Set(library.ids).size, 380);
    assert.ok(library.sources.every((s) => !s.url.includes('?')), 'query strings are stripped');
  });

  test('does not read the library again when the profile page says nothing changed, but does when it did (or when the copy is old)', async () => {
    const fake = createFakeBandcamp({ libraryCount: 250, wishlistCount: 130 });
    const first = await loadLibrary(fake.fetch, fake.profileUrl, FAST, null, 1_000_000);
    const calls = () => fake.calls.length;
    const before = calls();
    const again = await loadLibrary(fake.fetch, fake.profileUrl, FAST, first, 1_000_000 + 60_000);
    assert.equal(again, first, 'the saved copy is used');
    assert.equal(calls() - before, 1, 'one request: the profile page');

    const bigger = createFakeBandcamp({ libraryCount: 251, wishlistCount: 130 });
    const reloaded = await loadLibrary(bigger.fetch, bigger.profileUrl, FAST, first, 1_000_000 + 60_000);
    assert.equal(reloaded.collectionCount, 251, 'a purchase makes it read everything again');

    const old = await loadLibrary(fake.fetch, fake.profileUrl, FAST, first, 1_000_000 + 8 * 86_400_000);
    assert.notEqual(old, first, 'a week later it is read again anyway');
    assert.equal(await loadLibrary(fake.fetch, fake.profileUrl, FAST, { ...first, fingerprint: undefined }, 1_000_000).then((l) => l.sources.length), 380, 'a copy from an older version is read again');
  });

  test('stops instead of looping forever when the pagination token never advances', async () => {
    const fake = createFakeBandcamp({ libraryCount: 150 });
    const fetchWithStuckToken = async (url, options) => {
      const result = await fake.fetch(url, options);
      if (!/collection_items$/.test(String(url))) return result;
      const body = await result.json();
      return response(200, JSON.stringify({ ...body, last_token: JSON.parse(options.body).older_than_token, more_available: true }));
    };
    const library = await loadLibrary(fetchWithStuckToken, fake.profileUrl, FAST);
    assert.ok(library.collectionCount >= 20 && library.collectionCount <= 250);
  });
});

import { parseTags as parseTagsFromPage } from '../src/lib/bandcamp.js';
test('parseTags keeps genre tags and drops locations', () => {
  const tag = (name) => `<a class="tag" href="https://bandcamp.com/discover/${name}?from=tralbum&artist=1"\n   >${name}</a>`;
  const html = `${tag('electronic')}${tag('Techno')}${tag('Brooklyn')}<a class="tag" href="https://bandcamp.com/discover/x">Los Angeles, California</a>${tag('post-punk')}${tag('electronic')}<a class="tag" href="/other">nope</a>`;
  assert.deepEqual(parseTagsFromPage(html), ['electronic', 'postpunk']);
  assert.deepEqual(parseTagsFromPage('<html></html>'), []);
});

test('parseTags counts different spellings of a genre as one', () => {
  const tag = (name) => `<a class="tag" href="https://bandcamp.com/discover/x">${name}</a>`;
  assert.deepEqual(parseTagsFromPage(['e.b.m', 'EBM'.toLowerCase(), 'electronic body music', 'dark wave', 'darkwave', 'cold wave'].map(tag).join('')), ['ebm', 'darkwave', 'coldwave']);
});

import { isBandcampUrl, parseEmbeddedTracks, embeddedPlayerUrl } from '../src/lib/bandcamp.js';
test('isBandcampUrl tells bandcamp.com pages from labels on their own domain', () => {
  assert.ok(isBandcampUrl('https://artist.bandcamp.com/album/x'));
  assert.ok(isBandcampUrl('https://bandcamp.com/sumof'));
  assert.ok(!isBandcampUrl('https://listen.20buckspin.com/album/the-enduring-spirit'));
  assert.ok(!isBandcampUrl('https://evilbandcamp.com/x'));
  assert.ok(!isBandcampUrl('https://bandcamp.com.evil.example/x'));
  assert.ok(!isBandcampUrl('http://artist.bandcamp.com/x'));
});

test('albums on a label domain are played from the embedded player page', () => {
  assert.equal(embeddedPlayerUrl('2448143742'), 'https://bandcamp.com/EmbeddedPlayer/album=2448143742/size=large/tracklist=false/artwork=none/transparent=true/');
  const data = { featured_track_id: 22, tracks: [
    { id: 11, title: 'one', duration: 10, file: { 'mp3-128': 'https://t4.bcbits.com/stream/1' } },
    { id: 22, title: 'two', duration: 20, file: { 'mp3-128': 'https://t4.bcbits.com/stream/2' } },
    { id: 33, title: 'no file' },
  ] };
  const html = `<div data-player-data="${JSON.stringify(data).replace(/"/g, '&quot;')}"></div>`;
  const tracks = parseEmbeddedTracks(html);
  assert.deepEqual(tracks.map((t) => [t.title, t.featured]), [['one', false], ['two', true]]);
  assert.deepEqual(parseEmbeddedTracks('<html></html>'), []);
});

test('parseTags splits a list of hashtags into tags and drops the names of places', () => {
  const tag = (text) => `<a class="tag" href="https://bandcamp.com/discover/x">${text}</a>`;
  assert.deepEqual(parseTagsFromPage(tag('punk #ebm #lofi #post-punk')), ['punk', 'ebm', 'lofi', 'postpunk']);
  assert.deepEqual(parseTagsFromPage(['tbilisi', 'brazil', 'berlin', 'ebm'].map(tag).join('')), ['ebm']);
});

test('parseTags also splits tags written with commas, semicolons and slashes', () => {
  const tag = (text) => `<a class="tag" href="https://bandcamp.com/discover/x">${text}</a>`;
  assert.deepEqual(parseTagsFromPage(tag('rock, punk') + tag('hip-hop/rap') + tag('synthpop; darkwave') + tag('Los Angeles, California')), ['rock', 'punk', 'hiphop', 'rap', 'synthpop', 'darkwave']);
});
