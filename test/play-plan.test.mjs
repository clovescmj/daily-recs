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
