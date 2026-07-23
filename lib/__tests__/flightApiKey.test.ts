import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRealFlightKey } from '../flightApiKey';

describe('hasRealFlightKey', () => {
  test('undefined → false', () => {
    assert.equal(hasRealFlightKey(undefined), false);
  });

  test('null → false', () => {
    assert.equal(hasRealFlightKey(null), false);
  });

  test('empty string → false', () => {
    assert.equal(hasRealFlightKey(''), false);
  });

  test('whitespace-only → false', () => {
    assert.equal(hasRealFlightKey('   '), false);
  });

  test('placeholder YOUR_AVIATIONSTACK_KEY_HERE → false', () => {
    assert.equal(hasRealFlightKey('YOUR_AVIATIONSTACK_KEY_HERE'), false);
  });

  test('placeholder REPLACE_ME → false', () => {
    assert.equal(hasRealFlightKey('REPLACE_ME'), false);
  });

  test('realistic-looking key → true', () => {
    assert.equal(hasRealFlightKey('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'), true);
  });

  test('trims whitespace before comparing', () => {
    assert.equal(hasRealFlightKey('  YOUR_AVIATIONSTACK_KEY_HERE  '), false);
    assert.equal(hasRealFlightKey('  realkey123  '), true);
  });
});
