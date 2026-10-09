// Pure parts of the page layer (no DOM needed): markup generation and status text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardHtml } from '../src/pages/recs/cards.js';
import { progressParts } from '../src/pages/recs/status-line.js';
import { esc, formatTime, safeUrl } from '../src/pages/recs/dom.js';
import { PHASE } from '../src/lib/recommender.js';
import { parseMessage } from '../src/lib/messages.js';
import { DAILY_COUNT } from '../src/lib/state.js';

const album = { id: '1', title: 'A <b>"Title"</b>', artist: "O'Brien", artistId: '9', url: 'https://x.bandcamp.com/album/a', art: 'https://f4.bcbits.com/img/a.jpg', via: 'Other', fans: 3 };

test('esc escapes markup and quotes', () => {
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('safeUrl only lets https through', () => {
  assert.equal(safeUrl('https://a.b/c'), 'https://a.b/c');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('http://a.b'), '#');
});

test('formatTime renders m:ss and tolerates NaN', () => {
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(Number.NaN), '0:00');
});

test('cardHtml escapes album text and exposes accessible names', () => {
  const html = cardHtml(album, { liked: false, disliked: false });
  assert.ok(!html.includes('<b>"Title"</b>'), 'title must be escaped');
  assert.match(html, /aria-label="Add to wishlist: /);
  assert.match(html, /aria-label="Don't show music like this: |aria-label="Don&#39;t show music like this: /);
  assert.ok(!/data-like|thumb/i.test(html), 'there is no like button');
  assert.match(html, /data-save[^>]*aria-label="Add album to Liked Songs: /);
  assert.ok(!/go to album/i.test(html), 'no "go to album" link: the cover and the title already open it');
  assert.match(html, /People who own “Other” also own/);
  assert.match(html, /3 fans in common/);
});

test('cardHtml reflects liked / disliked state', () => {
  const html = cardHtml(album, { wished: true, disliked: true });
  assert.match(html, /is-disliked/);
  assert.match(html, /action-wishlist is-on/);
  assert.match(html, /Remove from wishlist/);
  assert.match(html, /Show this album again/);
  assert.match(cardHtml(album, { saved: true, disliked: false }), /action-save is-on[^>]*title="Remove album from Liked Songs"/);
  const neutral = cardHtml(album, { liked: false, disliked: false });
  assert.ok(!/is-on/.test(neutral), 'nothing is marked on a neutral card');
});

test('cardHtml never puts a non-https url into href/src', () => {
  const html = cardHtml({ ...album, url: 'javascript:alert(1)', art: 'data:text/html,x' }, { liked: false, disliked: false });
  assert.ok(!/javascript:/.test(html) && !/data:text/.test(html));
});

test('the page only sends messages the service worker accepts', () => {
  for (const raw of [
    { type: 'refresh', force: true, mode: 'surprise' },
    { type: 'feedback', id: '1', kind: 'dislike' },
    { type: 'wishlist-queue', op: 'add', id: '1', bandId: '9' },
    { type: 'wishlist-done', id: '1' },
    { type: 'mark-opened', id: '1' },
    { type: 'open-main' },
    { type: 'color-scheme', dark: true },
  ]) assert.ok(parseMessage(raw), JSON.stringify(raw));
});

import { reportBugUrl, supportUrl } from '../src/lib/config.js';
test('feedback links: store support page, and a prefilled GitHub bug report with nothing personal', () => {
  assert.equal(supportUrl('abcdefg'), 'https://chromewebstore.google.com/detail/abcdefg/support');
  const url = new URL(reportBugUrl('1.2.3', 'Mozilla/5.0 Test'));
  assert.equal(url.origin + url.pathname, 'https://github.com/clovescmj/daily-recs/issues/new');
  assert.equal(url.searchParams.get('labels'), 'bug');
  assert.match(url.searchParams.get('body'), /Daily Recs v1\.2\.3\nMozilla\/5\.0 Test/);
});

test('the loading box has a second line only when there is something to say', () => {
  assert.equal(progressParts({ phase: PHASE.SIGNING_IN }).detail, '');
  assert.equal(progressParts({ phase: PHASE.PICKING }).title, `Choosing your ${DAILY_COUNT}`);
  assert.equal(progressParts({ phase: PHASE.SAMPLING, done: 12, total: 60 }).detail, '12 of 60 albums');
  assert.equal(progressParts({ phase: PHASE.RANKING, candidates: 340 }).detail, '340 found');
  assert.match(progressParts({ phase: PHASE.SAMPLING, mode: 'tags', tagLabels: ['ambient'], done: 1, total: 4 }).title, /ambient/);
});
