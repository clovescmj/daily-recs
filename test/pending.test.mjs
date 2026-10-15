import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { pendingOutcome } from '../src/lib/pending.js';

describe('pendingOutcome', () => {
  test('a list that exists is ready, whatever the run says', () => {
    assert.equal(pendingOutcome({ sawRunning: false }, { hasList: true, running: false }), 'ready');
    assert.equal(pendingOutcome({ sawRunning: true }, { hasList: true, running: true }), 'ready');
  });

  test('a run that is going on is running; one that has not started yet is waiting', () => {
    assert.equal(pendingOutcome({ sawRunning: false }, { hasList: false, running: true }), 'running');
    assert.equal(pendingOutcome({ sawRunning: false }, { hasList: false, running: false }), 'waiting');
  });

  test('a run that was seen and is over, without a list, has ended', () => {
    assert.equal(pendingOutcome({ sawRunning: true }, { hasList: false, running: false }), 'ended');
  });
});
