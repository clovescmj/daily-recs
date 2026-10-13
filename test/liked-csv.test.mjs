import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { likedCsv, likedCsvName } from '../src/lib/liked-csv.js';

const pool = { 1: { title: 'Glass Season', artist: 'Echo Ensemble', url: 'https://echo.bandcamp.com/album/glass-season' }, 2: { title: 'Other', artist: 'B', url: 'http://x.example/a' } };

describe('likedCsv', () => {
  test('a header, then one line per song in the order they were added', () => {
    const csv = likedCsv([{ id: '1', i: 0, title: 'First' }, { id: '1', i: 2, title: 'Third' }], pool);
    assert.deepEqual(csv.trim().split('\r\n'), [
      'Artist,Song,Album,Album link,Album ID,Track number',
      'Echo Ensemble,First,Glass Season,https://echo.bandcamp.com/album/glass-season,1,1',
      'Echo Ensemble,Third,Glass Season,https://echo.bandcamp.com/album/glass-season,1,3',
    ]);
  });

  test('commas, quotes and line breaks are quoted', () => {
    const csv = likedCsv([{ id: '1', i: 0, title: 'He said "no", then\nleft' }], pool);
    assert.ok(csv.includes('"He said ""no"", then\nleft"'));
  });

  test('text that a spreadsheet would run as a formula is kept as text', () => {
    const csv = likedCsv([{ id: '1', i: 0, title: '=HYPERLINK("http://evil")' }, { id: '1', i: 1, title: '-1+1' }], pool);
    assert.ok(csv.includes("'=HYPERLINK"));
    assert.ok(csv.includes("'-1+1"));
  });

  test('an album the extension no longer knows keeps its id and track; a link that is not https is left out', () => {
    const lines = likedCsv([{ id: '9', i: 4, title: '' }, { id: '2', i: 0, title: 'x' }], pool).trim().split('\r\n');
    assert.equal(lines[1], ',Track 5,,,9,5');
    assert.equal(lines[2], 'B,x,Other,,2,1');
  });

  test('an empty list is only the header', () => {
    assert.equal(likedCsv([]).trim(), 'Artist,Song,Album,Album link,Album ID,Track number');
  });

  test('the file name has the date', () => {
    assert.equal(likedCsvName(new Date(2026, 9, 13)), 'daily-recs-liked-songs-2026-10-13.csv');
  });
});
