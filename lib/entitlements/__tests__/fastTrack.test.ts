import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFastTrack } from '../fastTrack';
import type { PassengerContext, StatusContext } from '../../normalization/types';
import type { FastTrackRuleInput } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2025-05-16T10:00:00');

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'HEL',
    arrivalAirport:       'FRA',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    ...overrides,
  };
}

function makeStatus(overrides: Partial<StatusContext> = {}): StatusContext {
  return {
    allianceTier: 'oneworld_sapphire',
    programCode:  'ay-plus',
    tierName:     'Gold',
    fastTrack:    true,
    ...overrides,
  };
}

function makeRule(overrides: Partial<FastTrackRuleInput> = {}): FastTrackRuleInput {
  return {
    id:                 1,
    priority:           100,
    validFrom:          '2020-01-01',
    validTo:            null,
    confidence:         0.95,
    minAllianceTier:    'oneworld_sapphire',
    carrierRestriction: null,
    conditions:         null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('evaluateFastTrack', () => {

  // ── Voimassaolosuodatin ────────────────────────────────────────────────────

  test('no rules → not available', () => {
    const r = evaluateFastTrack(makePassenger(), makeStatus(), [], NOW);
    assert.equal(r.available, false);
  });

  test('rule validFrom in future → skipped → not available', () => {
    const rule = makeRule({ validFrom: '2099-01-01' });
    const r = evaluateFastTrack(makePassenger(), makeStatus(), [rule], NOW);
    assert.equal(r.available, false);
  });

  test('rule validTo in past → skipped → not available', () => {
    const rule = makeRule({ validTo: '2020-12-31' });
    const r = evaluateFastTrack(makePassenger(), makeStatus(), [rule], NOW);
    assert.equal(r.available, false);
  });

  test('rule validTo null → no expiry → still active', () => {
    const rule = makeRule({ validTo: null });
    const r = evaluateFastTrack(makePassenger(), makeStatus(), [rule], NOW);
    assert.equal(r.available, true);
  });

  // ── Tier-vaatimus ─────────────────────────────────────────────────────────

  test('status meets minimum tier → available', () => {
    const rule = makeRule({ minAllianceTier: 'oneworld_sapphire' });
    const r = evaluateFastTrack(makePassenger(), makeStatus({ allianceTier: 'oneworld_sapphire' }), [rule], NOW);
    assert.equal(r.available, true);
  });

  test('emerald meets sapphire requirement (emerald > sapphire) → available', () => {
    const rule = makeRule({ minAllianceTier: 'oneworld_sapphire' });
    const r = evaluateFastTrack(makePassenger(), makeStatus({ allianceTier: 'oneworld_emerald' }), [rule], NOW);
    assert.equal(r.available, true);
  });

  test('ruby below sapphire requirement → not available', () => {
    const rule = makeRule({ minAllianceTier: 'oneworld_sapphire' });
    const r = evaluateFastTrack(makePassenger(), makeStatus({ allianceTier: 'oneworld_ruby' }), [rule], NOW);
    assert.equal(r.available, false);
  });

  test('no status, rule requires tier → not available', () => {
    const rule = makeRule({ minAllianceTier: 'oneworld_sapphire' });
    const r = evaluateFastTrack(makePassenger(), null, [rule], NOW);
    assert.equal(r.available, false);
  });

  test('minAllianceTier none requires status to be present', () => {
    // 'none' still requires some status card — rules with 'none' min use status.fastTrack gate
    const rule = makeRule({ minAllianceTier: 'none', carrierRestriction: null });
    const r = evaluateFastTrack(makePassenger(), null, [rule], NOW);
    assert.equal(r.available, false, 'No status card → denied even for none-tier rules');
  });

  // ── Carrier restriction ────────────────────────────────────────────────────

  test('carrier restriction matches operating carrier → available', () => {
    const rule = makeRule({ carrierRestriction: ['AY', 'BA'] });
    const r = evaluateFastTrack(makePassenger({ operatingCarrier: 'AY' }), makeStatus(), [rule], NOW);
    assert.equal(r.available, true);
  });

  test('carrier restriction does not match → not available', () => {
    const rule = makeRule({ carrierRestriction: ['BA', 'IB'] });
    const r = evaluateFastTrack(makePassenger({ operatingCarrier: 'AY' }), makeStatus(), [rule], NOW);
    assert.equal(r.available, false);
  });

  test('carrierRestriction null → no carrier restriction → available', () => {
    const rule = makeRule({ carrierRestriction: null });
    const r = evaluateFastTrack(makePassenger(), makeStatus(), [rule], NOW);
    assert.equal(r.available, true);
  });

  // ── Priority (korkein priority voittaa, first match wins) ────────────────

  test('multiple rules: higher priority wins, returns its confidence', () => {
    const low  = makeRule({ id: 1, priority: 50,  minAllianceTier: 'oneworld_sapphire', confidence: 0.75 });
    const high = makeRule({ id: 2, priority: 200, minAllianceTier: 'oneworld_sapphire', confidence: 0.95 });
    const r = evaluateFastTrack(makePassenger(), makeStatus(), [low, high], NOW);
    assert.equal(r.available, true);
    assert.equal(r.confidence, 0.95, 'Higher-priority rule confidence used');
  });

  test('first matching rule wins — lower-priority non-matching rule ignored', () => {
    const deny  = makeRule({ id: 1, priority: 50,  minAllianceTier: 'oneworld_emerald', confidence: 0.99 });
    const allow = makeRule({ id: 2, priority: 200, minAllianceTier: 'oneworld_sapphire', confidence: 0.95 });
    // High-priority rule (200) matches sapphire; low-priority rule (50) requires emerald (user has sapphire → denied by that rule)
    const r = evaluateFastTrack(makePassenger(), makeStatus({ allianceTier: 'oneworld_sapphire' }), [deny, allow], NOW);
    assert.equal(r.available, true);
    assert.equal(r.confidence, 0.95);
  });

  // ── 6B: status.fastTrack === false override ───────────────────────────────

  test('status.fastTrack false → not available even if airport rule matches', () => {
    const rule = makeRule({ minAllianceTier: 'oneworld_sapphire' });
    const r = evaluateFastTrack(
      makePassenger(),
      makeStatus({ allianceTier: 'oneworld_sapphire', fastTrack: false }),
      [rule],
      NOW,
    );
    assert.equal(r.available, false);
    assert.ok(r.reason.includes('not included') || r.reason.includes('tier'), 'Reason explains programme denial');
  });

  test('status.fastTrack true → normal evaluation proceeds', () => {
    const rule = makeRule({ minAllianceTier: 'oneworld_sapphire' });
    const r = evaluateFastTrack(
      makePassenger(),
      makeStatus({ allianceTier: 'oneworld_sapphire', fastTrack: true }),
      [rule],
      NOW,
    );
    assert.equal(r.available, true);
  });

  test('EK Skywards Gold (tier=none, fastTrack=true) + none-tier EK rule → available', () => {
    const rule = makeRule({ minAllianceTier: 'none', carrierRestriction: ['EK'] });
    const r = evaluateFastTrack(
      makePassenger({ operatingCarrier: 'EK', operatingAlliance: null }),
      makeStatus({ allianceTier: 'none', fastTrack: true }),
      [rule],
      NOW,
    );
    assert.equal(r.available, true);
  });

  test('EK Skywards Silver (tier=none, fastTrack=false) + none-tier EK rule → not available', () => {
    const rule = makeRule({ minAllianceTier: 'none', carrierRestriction: ['EK'] });
    const r = evaluateFastTrack(
      makePassenger({ operatingCarrier: 'EK', operatingAlliance: null }),
      makeStatus({ allianceTier: 'none', fastTrack: false }),
      [rule],
      NOW,
    );
    assert.equal(r.available, false);
  });

  // ── Conditions ────────────────────────────────────────────────────────────

  test('condition same_day_departure=true, passenger true → available', () => {
    const rule = makeRule({
      conditions: { op: 'same_day_departure', value: true },
    });
    const r = evaluateFastTrack(
      makePassenger({ sameDayDeparture: true }),
      makeStatus(),
      [rule],
      NOW,
    );
    assert.equal(r.available, true);
  });

  test('condition same_day_departure=true, passenger false → not available', () => {
    const rule = makeRule({
      conditions: { op: 'same_day_departure', value: true },
    });
    const r = evaluateFastTrack(
      makePassenger({ sameDayDeparture: false }),
      makeStatus(),
      [rule],
      NOW,
    );
    assert.equal(r.available, false);
  });

  // ── Output fields ─────────────────────────────────────────────────────────

  test('available result contains allianceTier in reason', () => {
    const rule = makeRule();
    const r = evaluateFastTrack(makePassenger(), makeStatus({ allianceTier: 'oneworld_sapphire' }), [rule], NOW);
    assert.ok(r.reason.includes('oneworld_sapphire'));
  });

  test('confidence comes from the matched rule', () => {
    const rule = makeRule({ confidence: 0.88 });
    const r = evaluateFastTrack(makePassenger(), makeStatus(), [rule], NOW);
    assert.equal(r.available, true);
    assert.equal(r.confidence, 0.88);
  });

  test('denied result has available=false and non-empty reason', () => {
    const r = evaluateFastTrack(makePassenger(), null, [], NOW);
    assert.equal(r.available, false);
    assert.ok(r.reason.length > 0);
  });

  // ── Determinismi ─────────────────────────────────────────────────────────

  test('same input → same output (determinism, 10 iterations)', () => {
    const rule   = makeRule();
    const status = makeStatus();
    const pax    = makePassenger();
    const first  = evaluateFastTrack(pax, status, [rule], NOW);
    for (let i = 0; i < 9; i++) {
      const r = evaluateFastTrack(pax, status, [rule], NOW);
      assert.deepEqual(r, first);
    }
  });
});
