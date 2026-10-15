import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPlayPlan } from '../src/lib/play-plan.js';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

describe('the play plan', () => {
  test('the first time an album plays its featured track, then others that have not played, never twice', () => {
    const plan = createPlayPlan(seeded());
    assert.equal(plan.pick('a', 4, 2), 2);
    plan.mark('a', 2, 4);
    const rest = [];
    for (let n = 0; n < 3; n += 1) { const i = plan.pick('a', 4, 2); rest.push(i); plan.mark('a', i, 4); }
    assert.deepEqual(rest.sort(), [0, 1, 3]);
    assert.equal(plan.pick('a', 4, 2), -1);
  });

  test('the round and the chosen songs come back as they were after a reload', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const first = createPlayPlan(seeded(11));
    const order = [...first.order('shuffle', ids)];
    const choice = first.pick('c', 6, 2);
    const copy = createPlayPlan(seeded(99));          // another random sequence: nothing may come from it
    copy.restore([], JSON.parse(JSON.stringify(first.snapshot())));
    assert.deepEqual([...copy.order('shuffle', ids)], order);
    assert.equal(copy.pick('c', 6, 2), choice);
  });

  test('asking for the order before the list is drawn does not lose the restored round', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const first = createPlayPlan(seeded(21));
    const order = [...first.order('shuffle', ids)];
    const copy = createPlayPlan(seeded(77));
    copy.restore([], JSON.parse(JSON.stringify(first.snapshot())));
    assert.deepEqual(copy.order('shuffle', []), []);   // the page asks before it has any card
    assert.deepEqual(copy.snapshot().round, order, 'the round is still there');
    assert.deepEqual([...copy.order('shuffle', ids)], order);
  });

  test('songs restored after a reload do not play again', () => {
    const plan = createPlayPlan(seeded(5));
    plan.restore([{ id: 'a', index: 0 }, { id: 'a', index: 2 }]);
    const picks = [];
    for (let n = 0; n < 2; n += 1) { const i = plan.pick('a', 4, 0); picks.push(i); plan.mark('a', i, 4); }
    assert.deepEqual(picks.sort(), [1, 3], 'only the songs that had not played');
    assert.equal(plan.pick('a', 4, 0), -1);
  });

  test('the track chosen for an album stays the same until it plays (the queue shows what will play)', () => {
    const plan = createPlayPlan(seeded(9));
    plan.mark('a', 0, 6);
    const first = plan.pick('a', 6, 0);
    for (let n = 0; n < 5; n += 1) assert.equal(plan.pick('a', 6, 0), first);
    plan.mark('a', first, 6);
    assert.notEqual(plan.pick('a', 6, 0), first, 'once it has played, another one');
  });

  test("'one' follows the list, starts over at the end and skips albums with no song left", () => {
    const plan = createPlayPlan(seeded());
    const ids = ['a', 'b', 'c'];
    plan.mark('a', 0, 2); plan.mark('b', 0, 1); plan.mark('c', 0, 2);
    assert.equal(plan.next('one', ids, 'a'), 'c', 'b has only one song and it has played');
    assert.equal(plan.next('one', ids, 'c'), 'a', 'a new round');
    plan.mark('a', 1, 2); plan.mark('c', 1, 2);
    assert.equal(plan.next('one', ids, 'c'), null, 'everything has played');
    assert.equal(plan.hasMore(ids), false);
    plan.reset();
    assert.equal(plan.next('one', ids, 'c'), 'a');
  });

  test("'shuffle' uses a random order that holds for the round, and a new one after it", () => {
    const plan = createPlayPlan(seeded(7));
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const first = [...plan.order('shuffle', ids)];
    assert.deepEqual([...first].sort(), ids);
    assert.notDeepEqual(first, ids, 'it is not the order of the list');
    assert.deepEqual(plan.order('shuffle', ids), first, 'it does not change while the round lasts');
    let current = first[0];
    const seen = [current];
    for (const id of ids) plan.mark(id, 0, 3);
    for (let n = 0; n < 4; n += 1) { current = plan.next('shuffle', ids, current); seen.push(current); }
    assert.deepEqual(seen, first, 'the round is walked in its order');
    const again = plan.next('shuffle', ids, current);
    assert.notEqual(again, current, 'not the same album twice in a row');
    assert.ok(ids.includes(again));
  });

  test('an album that arrives meanwhile joins the round, one that left is dropped', () => {
    const plan = createPlayPlan(seeded(3));
    plan.order('shuffle', ['a', 'b', 'c']);
    const order = plan.order('shuffle', ['a', 'c', 'd']);
    assert.deepEqual([...order].sort(), ['a', 'c', 'd']);
  });
});

describe('the radio: one song of each album', () => {
  const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  test('an album is done after one song, and it never comes back in a later round', () => {
    const plan = createPlayPlan(seeded(), { songsPerAlbum: 1 });
    const ids = ['a', 'b', 'c'];
    const played = [];
    let current = plan.next('shuffle', ids, null);
    while (current) {
      played.push(current);
      plan.mark(current, plan.pick(current, 5, 2), 5);
      current = plan.next('shuffle', ids, current);
    }
    assert.deepEqual([...played].sort(), ['a', 'b', 'c']);
    assert.equal(plan.hasMore(ids), false);
    assert.equal(plan.remaining(ids), 0);
  });

  test('albums that arrive later are played after the ones that were there', () => {
    const plan = createPlayPlan(seeded(), { songsPerAlbum: 1 });
    plan.mark('a', 0, 4);
    plan.mark('b', 1, 4);
    assert.equal(plan.remaining(['a', 'b']), 0);
    assert.equal(plan.remaining(['a', 'b', 'c', 'd']), 2);
    assert.ok(['c', 'd'].includes(plan.next('shuffle', ['a', 'b', 'c', 'd'], 'b')));
  });

  test('without the limit an album is done only when all its songs played (the plan of Full album is unchanged)', () => {
    const plan = createPlayPlan(seeded());
    plan.mark('a', 0, 2);
    assert.equal(plan.remaining(['a']), 1);
    plan.mark('a', 1, 2);
    assert.equal(plan.remaining(['a']), 0);
  });
});
