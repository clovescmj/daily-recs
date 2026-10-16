import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { latestNews, newsAction } from '../src/lib/news.js';

const page = `<h1>What's new</h1><p>You have <strong id="version">–</strong>.</p>
  <!-- one block per release -->
  <h2>1.5 · Songs, not albums</h2>
  <ul>
    <li>A card is <strong>one song</strong>, with its "artist" &amp; album.</li>
    <li>The next song is the next card.</li>
  </ul>
  <h2>1.4 · Older</h2><ul><li>Old news.</li></ul>`;

describe('latestNews', () => {
  test('the first block: its title and its items, as plain text', () => {
    assert.deepEqual(latestNews(page), {
      title: '1.5 · Songs, not albums',
      items: ['A card is one song, with its "artist" & album.', 'The next song is the next card.'],
    });
  });

  test('null when there is no block', () => {
    assert.equal(latestNews('<p>nothing</p>'), null);
    assert.equal(latestNews(''), null);
  });
});

describe('newsAction', () => {
  test('shown while the user has not closed that block', () => {
    assert.equal(newsAction({ title: '1.5', seen: '1.4', hasLibrary: true }), 'show');
  });
  test('not shown after it was closed', () => {
    assert.equal(newsAction({ title: '1.5', seen: '1.5', hasLibrary: true }), 'none');
  });
  test('a new user: only marked as seen', () => {
    assert.equal(newsAction({ title: '1.5', seen: undefined, hasLibrary: false }), 'mark');
  });
  test('a user of an older version, from before this notice existed: shown', () => {
    assert.equal(newsAction({ title: '1.5', seen: undefined, hasLibrary: true }), 'show');
  });
});
