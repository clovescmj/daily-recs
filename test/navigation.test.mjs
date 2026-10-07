// The toolbar icon: signed in goes to the profile panel; signed out goes to the login page and continues afterwards.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const created = [];
const updated = [];
const session = {};
let signedIn = true;

globalThis.fetch = async () => ({
  json: async () => (signedIn ? { fan_id: 7, collection_summary: { url: 'https://bandcamp.com/tester' } } : { error: true }),
});
globalThis.chrome = {
  runtime: { getURL: (path) => `chrome-extension://abc/${path}` },
  tabs: {
    create: async (options) => { created.push(options.url); return { id: 99 }; },
    update: async (id, options) => { updated.push([id, options.url]); },
    query: async () => [],
  },
  windows: { update: async () => {} },
  storage: {
    local: { get: async () => ({}) },
    session: {
      get: async (key) => ({ [key]: session[key] }),
      set: async (values) => Object.assign(session, values),
      remove: async (key) => { delete session[key]; },
    },
  },
};

const { openMainPage, continueAfterLogin, forgetLoginTab } = await import('../src/background/navigation.js');

describe('toolbar icon', () => {
  beforeEach(() => { created.length = 0; updated.length = 0; for (const key of Object.keys(session)) delete session[key]; signedIn = true; });

  test('signed in: opens the daily recs panel on the profile', async () => {
    await openMainPage();
    assert.deepEqual(created, ['https://bandcamp.com/tester#dailyrecs']);
  });

  test('signed out: opens the login page, not the profile', async () => {
    signedIn = false;
    await openMainPage();
    assert.deepEqual(created, ['https://bandcamp.com/login']);
    assert.equal(session.pendingLogin.tabId, 99);
  });

  test('after the user signs in, the login tab continues to daily recs', async () => {
    signedIn = false;
    await openMainPage();
    signedIn = true;
    await continueAfterLogin(99, { status: 'complete' }, { url: 'https://bandcamp.com/' });
    assert.deepEqual(updated, [[99, 'https://bandcamp.com/tester#dailyrecs']]);
    assert.equal(session.pendingLogin, undefined);
  });

  test('keeps waiting while the tab is still on a sign-in step, on another site, or not signed in yet', async () => {
    signedIn = false;
    await openMainPage();
    await continueAfterLogin(99, { status: 'complete' }, { url: 'https://bandcamp.com/login' });
    await continueAfterLogin(99, { status: 'complete' }, { url: 'https://accounts.google.com/signin' });
    await continueAfterLogin(99, { status: 'complete' }, {});
    await continueAfterLogin(99, { status: 'complete' }, { url: 'https://bandcamp.com/' }); // still signed out
    await continueAfterLogin(99, { status: 'loading' }, { url: 'https://bandcamp.com/' });
    assert.deepEqual(updated, []);
    assert.ok(session.pendingLogin);
  });

  test('ignores other tabs, and forgets the login tab when it is closed', async () => {
    signedIn = false;
    await openMainPage();
    signedIn = true;
    await continueAfterLogin(5, { status: 'complete' }, { url: 'https://bandcamp.com/' });
    assert.deepEqual(updated, []);
    await forgetLoginTab(99);
    assert.equal(session.pendingLogin, undefined);
  });
});
