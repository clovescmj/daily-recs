// When Bandcamp says "slow down", the extension waits and tries again by itself, a few times, with growing pauses.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const session = {};
const alarms = [];
globalThis.chrome = {
  storage: {
    session: {
      get: async (key) => ({ [key]: session[key] }),
      set: async (values) => Object.assign(session, values),
      remove: async (key) => { delete session[key]; },
    },
    local: { get: async () => ({}), set: async () => {} },
  },
  alarms: { create: async (name, info) => { alarms.push({ name, ...info }); } },
  action: { setBadgeText: async () => {} },
};

const { planRetry } = await import('../src/background/jobs.js');
const MIN = 60 * 1000;
const setStatus = (status) => { session.status = { updatedAt: Date.now(), ...status }; };

describe('rate limit retry', () => {
  beforeEach(() => { alarms.length = 0; for (const key of Object.keys(session)) delete session[key]; });

  test('schedules a retry in 5 minutes and publishes the time for the countdown', async () => {
    setStatus({ running: false, error: 'rate_limited', scope: 'list', mode: 'best' });
    const before = Date.now();
    await planRetry();
    assert.equal(alarms.length, 1);
    assert.ok(Math.abs(alarms[0].when - (before + 5 * MIN)) < 2000);
    assert.equal(session.status.retryAt, alarms[0].when);
    assert.equal(session.status.error, 'rate_limited');
  });

  test('waits longer each time and gives up after three attempts', async () => {
    const delays = [];
    for (let attempt = 1; attempt <= 4; attempt++) {
      setStatus({ running: false, error: 'rate_limited', scope: 'list', mode: 'best' });
      const before = Date.now();
      await planRetry();
      delays.push(alarms.length ? Math.round((alarms[alarms.length - 1].when - before) / MIN) : null);
      if (attempt < 4) alarms.length = 0;
    }
    assert.deepEqual(delays.slice(0, 3), [5, 10, 15]);
    assert.equal(session.status.retryAt, undefined, 'no retry planned after giving up');
  });

  test('does nothing for other errors, and forgets the attempts after a success', async () => {
    setStatus({ running: false, error: 'not_logged_in', scope: 'list' });
    await planRetry();
    assert.equal(alarms.length, 0);
    session.retryAttempt = 2;
    setStatus({ running: false, finishedAt: Date.now(), scope: 'list' });
    await planRetry();
    assert.equal(session.retryAttempt, undefined);
  });

  test('does not plan a second retry while one is already waiting', async () => {
    setStatus({ running: false, error: 'rate_limited', retryAt: Date.now() + 3 * MIN, scope: 'list' });
    await planRetry();
    assert.equal(alarms.length, 0);
  });
});
