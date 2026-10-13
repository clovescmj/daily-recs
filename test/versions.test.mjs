import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isMajorUpdate } from '../src/lib/versions.js';

describe('isMajorUpdate', () => {
  test('a new minor or major version is a major update', () => {
    assert.equal(isMajorUpdate('1.2.30', '1.3.0'), true);
    assert.equal(isMajorUpdate('1.9.4', '2.0.0'), true);
  });

  test('a new patch version is not', () => {
    assert.equal(isMajorUpdate('1.2.30', '1.2.31'), false);
    assert.equal(isMajorUpdate('1.2.0', '1.2.0'), false);
  });

  test('going back, or a version that is not a number, is not', () => {
    assert.equal(isMajorUpdate('1.3.0', '1.2.9'), false);
    assert.equal(isMajorUpdate('2.0.0', '1.9.9'), false);
    assert.equal(isMajorUpdate(undefined, '1.3.0'), false);
    assert.equal(isMajorUpdate('1.2', '1.3.0'), false);
  });
});
