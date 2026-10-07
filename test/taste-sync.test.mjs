import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../src/lib/state.js';
import {
  VOTE, buildDoc, hashSource, mergeRemote, migrateTaste, pull, push, rebuildVoteLists, summary, syncState,
} from '../src/lib/taste-sync.js';

// chrome.storage.sync stand-in that enforces the real limits (8 KB per item, ~100 KB total)
const QUOTA_PER_ITEM = 8192;
const QUOTA_TOTAL = 102_400;
function createSyncArea() {
  const memory = {};
  const bytes = (key, value) => key.length + JSON.stringify(value).length;
  return {
    memory,
    get: async (keys) => Object.fromEntries([].concat(keys).filter((key) => key in memory).map((key) => [key, memory[key]])),
    set: async (items) => {
      for (const [key, value] of Object.entries(items)) {
        if (bytes(key, value) > QUOTA_PER_ITEM) throw new Error(`QUOTA_BYTES_PER_ITEM exceeded: ${key}`);
      }
      const total = Object.entries({ ...memory, ...items }).reduce((sum, [key, value]) => sum + bytes(key, value), 0);
      if (total > QUOTA_TOTAL) throw new Error(`QUOTA_BYTES exceeded: ${total}`);
      Object.assign(memory, items);
    },
    remove: async (keys) => keys.forEach((key) => delete memory[key]),
    total: () => Object.entries(memory).reduce((sum, [key, value]) => sum + bytes(key, value), 0),
  };
}

const NOW = Date.now() / 1000;
const setVote = (state, id, vote, seconds) => { state.votes[id] = `${vote}.${Math.floor(seconds).toString(36)}`; };

describe('sync between devices', () => {
  test('device B receives the votes and the thermometer of device A', async () => {
    const cloud = createSyncArea();
    const a = emptyState();
    a.liked = ['1', '2', '3']; a.dismissed = ['9', '8'];
    a.sourceLikes = { 'https://a.bandcamp.com/album/x': 2 };         // legacy URL keys are hashed on migration
    a.sourceDislikes = { 'https://c.bandcamp.com/album/z': 3 };
    const pushed = (await syncState(cloud, a)).pushed;
    assert.ok(pushed.bytes < 1000);
    assert.equal(a.sourceLikes[hashSource('https://a.bandcamp.com/album/x')], 2);

    const b = emptyState();
    const result = await syncState(cloud, b);
    assert.deepEqual([...b.liked].sort(), ['1', '2', '3']);
    assert.deepEqual([...b.dismissed].sort(), ['8', '9']);
    assert.equal(b.sourceDislikes[hashSource('https://c.bandcamp.com/album/z')], 3);
    assert.equal(result.pushed, null, 'nothing to upload when both sides are equal');
  });

  test('removing a like spreads, and a stale device does not resurrect it', async () => {
    const cloud = createSyncArea();
    const a = emptyState(); a.liked = ['2']; migrateTaste(a);
    setVote(a, '2', VOTE.UNLIKE, NOW + 100); rebuildVoteLists(a);
    await syncState(cloud, a);
    const stale = emptyState(); setVote(stale, '2', VOTE.LIKE, NOW - 1000); rebuildVoteLists(stale);
    await syncState(cloud, stale);
    assert.ok(!stale.liked.includes('2'));
  });

  test('an undone dislike spreads and clears the old dislike on another device', async () => {
    const cloud = createSyncArea();
    const a = emptyState(); migrateTaste(a); setVote(a, 'a', VOTE.UNDISLIKE, NOW + 10); rebuildVoteLists(a);
    await syncState(cloud, a);
    const other = emptyState(); setVote(other, 'a', VOTE.DISLIKE, NOW - 5000); rebuildVoteLists(other);
    await syncState(cloud, other);
    assert.ok(!other.dismissed.includes('a'));
  });

  test('conflicting votes: the most recent one wins on both devices', async () => {
    const cloud = createSyncArea();
    const a = emptyState(); const b = emptyState(); migrateTaste(a); migrateTaste(b);
    setVote(a, '77', VOTE.LIKE, NOW + 10); rebuildVoteLists(a); await syncState(cloud, a);
    setVote(b, '77', VOTE.DISLIKE, NOW + 20); rebuildVoteLists(b); await syncState(cloud, b);
    await syncState(cloud, a);
    assert.ok(a.dismissed.includes('77') && !a.liked.includes('77'));
    assert.ok(b.dismissed.includes('77'));
  });
});

describe('quota handling', () => {
  test('500 votes and 3,000 source scores fit, in chunks, without losing a vote', async () => {
    const cloud = createSyncArea();
    const big = emptyState(); migrateTaste(big);
    for (let i = 0; i < 300; i++) setVote(big, String(4_000_000_000 + i), VOTE.LIKE, NOW + i);
    for (let i = 0; i < 200; i++) setVote(big, String(5_000_000_000 + i), VOTE.DISLIKE, NOW + i);
    for (let i = 0; i < 3000; i++) big.sourceLikes[hashSource(`https://x.bandcamp.com/album/${i}`)] = 1 + (i % 5);
    rebuildVoteLists(big);
    const { pushed } = await syncState(cloud, big);
    assert.ok(pushed.items > 1);
    const fresh = emptyState(); await syncState(cloud, fresh);
    assert.equal(fresh.liked.length, 300);
    assert.equal(fresh.dismissed.length, 200);
  });

  test('over budget: drops the weakest scores first and never exceeds the quota', async () => {
    const cloud = createSyncArea();
    const huge = emptyState(); migrateTaste(huge);
    for (let i = 0; i < 50; i++) setVote(huge, String(6_000_000_000 + i), VOTE.LIKE, NOW + i);
    for (let i = 0; i < 12_000; i++) huge.sourceLikes[hashSource(`https://h.bandcamp.com/album/${i}`)] = 1 + (i % 9);
    rebuildVoteLists(huge);
    await syncState(cloud, huge);
    assert.ok(cloud.total() < QUOTA_TOTAL, `${cloud.total()} bytes`);
    const doc = await pull(cloud);
    assert.equal(Object.keys(doc.m).length, 50, 'all votes kept');
    assert.ok(Math.min(...Object.values(doc.ls)) >= 2, 'the weakest scores were the ones dropped');
  });

  test('removes stale chunks when the document shrinks', async () => {
    const cloud = createSyncArea();
    const big = emptyState(); migrateTaste(big);
    for (let i = 0; i < 4000; i++) big.sourceLikes[hashSource(`u${i}`)] = 3;
    await push(cloud, big);
    const before = Object.keys(cloud.memory).filter((key) => /^taste:\d+$/.test(key)).length;
    await push(cloud, emptyState());
    const after = Object.keys(cloud.memory).filter((key) => /^taste:\d+$/.test(key)).length;
    assert.ok(before > 1 && after === 1, `${before} -> ${after}`);
  });

  test('old tombstones are not uploaded', () => {
    const state = emptyState(); migrateTaste(state);
    setVote(state, 'old', VOTE.UNLIKE, NOW - 200 * 86400);
    setVote(state, 'recent', VOTE.UNLIKE, NOW - 10 * 86400);
    assert.deepEqual(Object.keys(buildDoc(state).m), ['recent']);
  });
});

test('summary counts likes and dislikes', async () => {
  const cloud = createSyncArea();
  const state = emptyState(); migrateTaste(state);
  setVote(state, '1', VOTE.LIKE, NOW); setVote(state, '2', VOTE.LIKE, NOW); setVote(state, '3', VOTE.DISLIKE, NOW); setVote(state, '4', VOTE.UNLIKE, NOW);
  await push(cloud, state);
  const result = await summary(cloud);
  assert.equal(result.likes, 2);
  assert.equal(result.dislikes, 1);
});

test('mergeRemote ignores documents with an unknown version', () => {
  assert.equal(mergeRemote(emptyState(), { v: 99, m: { a: 'l.1' } }), false);
});
