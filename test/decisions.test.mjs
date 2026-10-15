import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_DECISIONS, addDecision, decisionEntry } from '../src/lib/decisions.js';

const candidate = { srcs: { a: 3, b: 12 }, tags: ['postpunk', 'darkwave', 'ebm', 'synthpop'], hop: true };

describe('the record of decisions', () => {
  test('an entry says how much evidence the album had', () => {
    const entry = decisionEntry({ id: 5, kind: 'dislike', view: 'tags', candidate, fit: 0.4567, now: 10 });
    assert.deepEqual(entry, { at: 10, id: '5', action: 'hide', view: 'tags', sources: 2, fans: 12, tags: ['postpunk', 'darkwave', 'ebm'], fit: 0.46, hop: true, surprise: false });
  });

  test('kinds that are not decisions of taste are not recorded', () => {
    assert.equal(decisionEntry({ id: 5, kind: 'unsave', candidate }), null);
    assert.equal(decisionEntry({ id: 5, kind: 'nonsense', candidate }), null);
  });

  test('the record keeps the latest ones', () => {
    let list = [];
    for (let i = 0; i < MAX_DECISIONS + 5; i += 1) list = addDecision(list, decisionEntry({ id: i + 1, kind: 'wish', now: i }));
    assert.equal(list.length, MAX_DECISIONS);
    assert.equal(list[0].at, 5);
  });
});
