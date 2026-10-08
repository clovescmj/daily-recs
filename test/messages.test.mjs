import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MSG, parseMessage } from '../src/lib/messages.js';
import { createMessageHandler } from '../src/background/messages.js';

const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';
const EXT_URL = `chrome-extension://${EXT_ID}/`;

describe('parseMessage', () => {
  test('accepts well-formed messages and normalises them', () => {
    assert.deepEqual(parseMessage({ type: MSG.REFRESH, force: true, mode: 'surprise', junk: 1 }), { type: 'refresh', force: true, mode: 'surprise', tags: [] });
    assert.deepEqual(parseMessage({ type: MSG.REFRESH, mode: 'whatever' }), { type: 'refresh', force: false, mode: 'best', tags: [] });
    assert.deepEqual(parseMessage({ type: MSG.REFRESH, mode: 'tags', tags: ['metal', 'post punk!', 42, 'noise'] }), { type: 'refresh', force: false, mode: 'tags', tags: ['metal', 'noise'] });
    assert.deepEqual(parseMessage({ type: MSG.EXTEND_LIST, view: 'tags', tags: ['metal'] }), { type: 'extend-list', view: 'tags', tags: ['metal'] });
    assert.deepEqual(parseMessage({ type: MSG.EXTEND_LIST, view: 'x' }), { type: 'extend-list', view: 'best', tags: [] });
    assert.deepEqual(parseMessage({ type: MSG.FEEDBACK, id: '123', kind: 'dislike' }), { type: 'feedback', id: '123', kind: 'dislike' });
    assert.deepEqual(parseMessage({ type: MSG.FEEDBACK, id: '9', kind: 'wish' }), { type: 'feedback', id: '9', kind: 'wish' });
    assert.deepEqual(parseMessage({ type: MSG.WISHLIST_OP, op: 'add', id: 5, bandId: '6' }), { type: 'wishlist-op', op: 'add', id: '5', bandId: '6' });
  });

  test('rejects malformed or hostile payloads', () => {
    const bad = [
      null, 'x', 42, {}, { type: 'unknown' },
      { type: MSG.FEEDBACK, id: '12; drop', kind: 'like' },
      { type: MSG.FEEDBACK, id: '12', kind: 'delete-everything' },
      { type: MSG.WISHLIST_OP, op: 'add', id: '1' },
      { type: MSG.WISHLIST_OP, op: 'nuke', id: '1', bandId: '2' },
      { type: MSG.WISHLIST_QUEUE, op: 'add', id: '<script>', bandId: '2' },
      { type: MSG.MARK_OPENED },
    ];
    for (const message of bad) assert.equal(parseMessage(message), null, JSON.stringify(message));
  });
});

describe('message handler', () => {
  const calls = [];
  const jobs = new Proxy({}, { get: (_, name) => async (...args) => { calls.push([name, ...args]); } });
  const runInPage = async (tabId, op) => ({ ok: true, tabId, op });
  const schemes = [];
  const handle = createMessageHandler({ extensionId: EXT_ID, extensionUrl: EXT_URL, runInPage, jobs, setScheme: async (dark) => { schemes.push(dark); } });

  const fromPage = { id: EXT_ID, url: `${EXT_URL}src/pages/recs/recs.html`, tab: { id: 7 } };
  const fromProfile = { id: EXT_ID, url: 'https://bandcamp.com/someone', tab: { id: 7 } };
  const reset = () => { calls.length = 0; };

  test('dispatches valid messages from extension pages', async () => {
    reset();
    assert.deepEqual(await handle({ type: MSG.FEEDBACK, id: '10', kind: 'like' }, fromPage), { ok: true });
    assert.deepEqual(await handle({ type: MSG.MARK_OPENED, id: '10' }, fromPage), { ok: true });
    assert.deepEqual(calls.map((c) => c[0]), ['runFeedback', 'runMarkOpened']);
    assert.deepEqual(calls[0][1], { type: 'feedback', id: '10', kind: 'like' });
  });

  test('the colour scheme (for the toolbar icon) is accepted from our pages and from the profile tab, only as a boolean', async () => {
    schemes.length = 0;
    assert.deepEqual(await handle({ type: MSG.COLOR_SCHEME, dark: true }, fromProfile), { ok: true });
    assert.deepEqual(await handle({ type: MSG.COLOR_SCHEME, dark: 'yes' }, fromPage), { ok: true });
    assert.deepEqual(schemes, [true, false]);
    const stranger = { id: 'someone-else', url: 'https://bandcamp.com/x', tab: { id: 1 } };
    assert.deepEqual(await handle({ type: MSG.COLOR_SCHEME, dark: true }, stranger), { ok: false, error: 'sender not allowed' });
  });

  test('refuses requests from other extensions or from web pages', async () => {
    reset();
    for (const sender of [
      { id: 'someone-else', url: `${EXT_URL}x.html` },
      { id: EXT_ID, url: 'https://evil.example/', tab: { id: 1 } },
      { id: EXT_ID, url: 'https://bandcamp.com/page', tab: { id: 1 } },   // a content script may not give feedback
      undefined,
    ]) {
      const result = await handle({ type: MSG.FEEDBACK, id: '10', kind: 'like' }, sender);
      assert.equal(result.ok, false);
    }
    assert.equal(calls.length, 0);
  });

  test('running code in a Bandcamp tab is only allowed from the content script on bandcamp.com', async () => {
    reset();
    const message = { type: MSG.WISHLIST_OP, op: 'add', id: '1', bandId: '2' };
    assert.equal((await handle(message, fromPage)).ok, false, 'not from our own page');
    assert.equal((await handle(message, { id: EXT_ID, url: 'https://evil.example/', tab: { id: 1 } })).ok, false);
    assert.equal((await handle(message, { id: EXT_ID, url: 'https://bandcamp.com/me' })).ok, false, 'needs a tab');
    const result = await handle(message, fromProfile);
    assert.equal(result.ok, true);
    assert.equal(result.tabId, 7, 'runs in the tab that asked');
  });

  test('invalid messages are answered, never ignored', async () => {
    assert.deepEqual(await handle({ type: 'bogus' }, fromPage), { ok: false, error: 'invalid message' });
  });
});
