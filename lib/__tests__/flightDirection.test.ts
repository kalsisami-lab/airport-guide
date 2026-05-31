import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getFlightDirectionGuess, classifyFlightNumber } from '../flightDirection';

describe('getFlightDirectionGuess', () => {
  // hub_finnair: odd = outbound
  test('AY1411 → outbound from HEL', () => {
    const r = getFlightDirectionGuess('AY1411');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'outbound');
    assert.equal(r.from, 'HEL');
  });

  test('AY1412 → inbound to HEL', () => {
    const r = getFlightDirectionGuess('AY1412');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'inbound');
  });

  test('EK1 → outbound from DXB (odd, hub_finnair)', () => {
    const r = getFlightDirectionGuess('EK1');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'outbound');
    assert.equal(r.from, 'DXB');
  });

  test('QF1 → outbound from SYD (odd, hub_finnair)', () => {
    const r = getFlightDirectionGuess('QF1');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'outbound');
    assert.equal(r.from, 'SYD');
  });

  // hub_lufthansa: even = outbound (THE BUG FIX)
  test('LH430 → outbound from FRA (even, hub_lufthansa)', () => {
    const r = getFlightDirectionGuess('LH430');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'outbound');
    assert.equal(r.from, 'FRA');
  });

  test('LH431 → inbound to FRA (odd, hub_lufthansa)', () => {
    const r = getFlightDirectionGuess('LH431');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'inbound');
  });

  test('BA112 → outbound from LHR (even, hub_lufthansa)', () => {
    const r = getFlightDirectionGuess('BA112');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'outbound');
    assert.equal(r.from, 'LHR');
  });

  test('BA113 → inbound to LHR (odd, hub_lufthansa)', () => {
    const r = getFlightDirectionGuess('BA113');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'inbound');
  });

  // LH400 — the specific regression case from the brief
  test('LH400 → outbound from FRA (regression: was returning inbound)', () => {
    const r = getFlightDirectionGuess('LH400');
    assert.equal(r.confidence, 'high');
    assert(r.confidence === 'high' && r.direction === 'outbound');
    assert.equal(r.from, 'FRA');
  });

  // Unknown carrier → low confidence
  test('XX123 → unknown (carrier not in table)', () => {
    const r = getFlightDirectionGuess('XX123');
    assert.equal(r.confidence, 'low');
    assert.equal(r.direction, 'unknown');
  });

  // compass_us → low confidence (no parity convention)
  test('UA100 → unknown (compass_us scheme, no parity)', () => {
    const r = getFlightDirectionGuess('UA100');
    assert.equal(r.confidence, 'low');
    assert.equal(r.direction, 'unknown');
  });

  test('AA1 → unknown (compass_us scheme, no parity)', () => {
    const r = getFlightDirectionGuess('AA1');
    assert.equal(r.confidence, 'low');
    assert.equal(r.direction, 'unknown');
  });
});

describe('classifyFlightNumber', () => {
  test('AY15 → flagship (1–99)', () => {
    assert.equal(classifyFlightNumber('AY15'), 'flagship');
  });

  test('AY101 → regular (100–2999)', () => {
    assert.equal(classifyFlightNumber('AY101'), 'regular');
  });

  test('AY1578 → regular (4-digit, 1000–2999 range)', () => {
    assert.equal(classifyFlightNumber('AY1578'), 'regular');
  });

  test('AY6701 → codeshare (3000–8999)', () => {
    assert.equal(classifyFlightNumber('AY6701'), 'codeshare');
  });

  test('AY9001 → ferry_charter (9000–9999)', () => {
    assert.equal(classifyFlightNumber('AY9001'), 'ferry_charter');
  });

  test('AY1 → flagship (single digit)', () => {
    assert.equal(classifyFlightNumber('AY1'), 'flagship');
  });

  test('AY3000 → codeshare (lower boundary)', () => {
    assert.equal(classifyFlightNumber('AY3000'), 'codeshare');
  });

  test('AY8999 → codeshare (upper boundary)', () => {
    assert.equal(classifyFlightNumber('AY8999'), 'codeshare');
  });
});
