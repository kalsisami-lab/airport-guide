/**
 * Phase 21: Alliance matching — engine fallback for all_alliance rules.
 *
 * Bug 1 (previously fell through to paid_available / denied without explanation):
 *   oneworld status + SAS flight (Star Alliance) + oneworld all_alliance lounge
 *   → engine now returns `not_applicable` with a clear reason instead.
 *
 * Reunatapaus (previously fell through to denied):
 *   oneworld status + no flight number (UNKN carrier) + oneworld all_alliance lounge
 *   → engine now returns `likely_allowed` prompting the user to add a flight.
 *
 * §17: HEL Finnair Lounge and Platinum Wing were over-restricted to AY-only
 * (carrier_specific ['AY']). Post-Phase 21, they are all_alliance and grant
 * access to any oneworld sapphire/emerald status holder on any oneworld carrier.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceCode, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-03T10:00:00');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'HEL',
    arrivalAirport:       'LHR',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    arrivalCountryCode:   'GB',
    arrivalIsSchengen:    false,
    passengerZone:        null,
    ...overrides,
  };
}

function makeStatus(tier: AllianceTier): StatusContext {
  return { allianceTier: tier, programCode: 'test', tierName: tier, fastTrack: false };
}

function makeRule(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    id: 1, priority: 100, validFrom: '2020-01-01', validTo: null,
    confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null,
    ...overrides,
  };
}

function makeChannel(
  channelType: ChannelType,
  allianceAccess: ChannelInput['allianceAccess'],
  rules: RuleInput[],
  id = 1,
): ChannelInput {
  return { id, channelType, allianceAccess, rules };
}

function makeLounge(channels: ChannelInput[], overrides: Partial<LoungeInput> = {}): LoungeInput {
  return {
    id:           1,
    name:         'Test Lounge',
    terminalId:   null,
    openingHours: null,
    area:         'all',
    channels,
    exceptions:   [],
    ...overrides,
  };
}

// oneworld all_alliance sapphire lounge (mimics AA Admirals JFK / Finnair Lounge)
function makeOneworldSapphireLounge(extraChannels: ChannelInput[] = []): LoungeInput {
  return makeLounge([
    makeChannel('alliance_status', 'all_alliance', [
      makeRule({ minAllianceTier: 'oneworld_sapphire' }),
    ]),
    ...extraChannels,
  ]);
}

// ─── A1–A5: core alliance-matching fallback logic ────────────────────────────

describe('Phase 21 — alliance fallback (Bug 1 fix)', () => {

  test('A1: oneworld Sapphire + AY flight + oneworld all_alliance lounge → allowed', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeOneworldSapphireLounge(), { now: NOW });
    assert.equal(r.status, 'allowed');
  });

  test('A2: oneworld Sapphire + SK (Star Alliance) flight → not_applicable', () => {
    const p = makePassenger({ operatingCarrier: 'SK', operatingAlliance: 'star_alliance' });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeOneworldSapphireLounge(), { now: NOW });
    assert.equal(r.status, 'not_applicable');
    assert.equal(r.source, 'alliance_mismatch');
    assert.match(r.reason, /oneworld/);
    assert.match(r.reason, /different alliance/);
  });

  test('A3: oneworld Sapphire + no flight (UNKN carrier) → likely_allowed', () => {
    const p = makePassenger({ operatingCarrier: 'UNKN', operatingAlliance: null });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeOneworldSapphireLounge(), { now: NOW });
    assert.equal(r.status, 'likely_allowed');
    assert.equal(r.source, 'alliance_unknown_carrier');
    assert.match(r.reason, /add your flight to confirm/);
    assert.match(r.reason, /oneworld/);
  });

  test('A4: Star Gold + LH flight + oneworld all_alliance lounge → not_applicable', () => {
    const p = makePassenger({ operatingCarrier: 'LH', operatingAlliance: 'star_alliance' });
    const s = makeStatus('star_gold');
    // Status is star_gold, lounge requires oneworld_sapphire → tier check fails
    // (meetsTier returns false across alliances), so no fallback signal fires.
    // Result: denied (default), not not_applicable. This validates that
    // tier-mismatch across alliances is denied, not not_applicable.
    const r = evaluateLoungeAccess(p, s, makeOneworldSapphireLounge(), { now: NOW });
    assert.equal(r.status, 'denied');
  });

  test('A5: Star Gold + LH flight + star all_alliance lounge → allowed', () => {
    const p = makePassenger({ operatingCarrier: 'LH', operatingAlliance: 'star_alliance' });
    const s = makeStatus('star_gold');
    const lounge = makeLounge([
      makeChannel('alliance_status', 'all_alliance', [
        makeRule({ minAllianceTier: 'star_gold' }),
      ]),
    ]);
    const r = evaluateLoungeAccess(p, s, lounge, { now: NOW });
    assert.equal(r.status, 'allowed');
  });
});

// ─── A6–A7: paid + PP interaction with alliance mismatch ─────────────────────

describe('Phase 21 — paid / PP coexistence with alliance mismatch', () => {

  test('A6: oneworld Sapphire + SK flight + lounge (all_alliance + paid), no PP card → not_applicable (mismatch wins over paid)', () => {
    const p = makePassenger({ operatingCarrier: 'SK', operatingAlliance: 'star_alliance' });
    const s = makeStatus('oneworld_sapphire');
    const lounge = makeLounge([
      makeChannel('alliance_status', 'all_alliance', [
        makeRule({ minAllianceTier: 'oneworld_sapphire' }),
      ]),
      makeChannel('paid', null, [makeRule()], 2),
    ]);
    const r = evaluateLoungeAccess(p, s, lounge, { now: NOW, passengerCards: [] });
    assert.equal(r.status, 'not_applicable');
    assert.equal(r.source, 'alliance_mismatch');
  });

  test('A7: oneworld Sapphire + SK flight + lounge (all_alliance + PP) with PP card → allowed via PP', () => {
    const p = makePassenger({ operatingCarrier: 'SK', operatingAlliance: 'star_alliance' });
    const s = makeStatus('oneworld_sapphire');
    const lounge = makeLounge([
      makeChannel('alliance_status', 'all_alliance', [
        makeRule({ minAllianceTier: 'oneworld_sapphire' }),
      ]),
      makeChannel('priority_pass', null, [makeRule({ confidence: 0.9 })], 2),
    ]);
    const r = evaluateLoungeAccess(p, s, lounge, { now: NOW, passengerCards: ['priority_pass'] });
    assert.equal(r.status, 'allowed');
    assert.equal(r.accessVia, 'Priority Pass');
  });
});

// ─── A8–A11: §17 regression — HEL Finnair Lounge / Platinum Wing ─────────────

// Mirrors DB state post-§17 patch (rules 1, 2, 3 → all_alliance).
function makeFinnairLoungeSchengen(): LoungeInput {
  return makeLounge([
    makeChannel('alliance_status', 'all_alliance', [
      makeRule({ minAllianceTier: 'oneworld_sapphire', confidence: 0.99 }),
    ]),
    // airline_own AY channel (unchanged by §17)
    makeChannel('airline_own', null, [
      makeRule({ carrierRestriction: ['AY'], confidence: 0.95 }),
    ], 2),
  ], { id: 3, name: 'Finnair Lounge', area: 'schengen' });
}

function makeFinnairPlatinumWing(): LoungeInput {
  return makeLounge([
    makeChannel('alliance_status', 'all_alliance', [
      makeRule({ minAllianceTier: 'oneworld_emerald', confidence: 0.99 }),
    ]),
  ], { id: 1, name: 'Finnair Platinum Wing', area: 'non_schengen' });
}

describe('Phase 21 — §17 regression: HEL Finnair Lounges', () => {

  test('A8: AY Gold + AY-Schengen flight + Finnair Lounge Schengen → allowed (regression: AY still works)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeSchengen(), { now: NOW });
    assert.equal(r.status, 'allowed');
  });

  test('A9: BA-status oneworld_sapphire + BA flight → Finnair Lounge Schengen allowed (§17 core fix)', () => {
    const p = makePassenger({
      operatingCarrier: 'BA', operatingAlliance: 'oneworld',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeSchengen(), { now: NOW });
    assert.equal(r.status, 'allowed');
    // Ensure the reason references alliance status, not the AY carrier-own channel
    assert.match(r.reason, /oneworld_sapphire/);
  });

  test('A10: AY Gold + AY Schengen flight (HEL→FRA) + Platinum Wing (non_schengen) → physically_unreachable', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_emerald');
    const r = evaluateLoungeAccess(p, s, makeFinnairPlatinumWing(), { now: NOW });
    assert.equal(r.status, 'physically_unreachable');
    assert.equal(r.source, 'schengen_zone_check');
  });

  test('A11: Star Gold + LH flight + Finnair Lounge Schengen → denied (wrong alliance + tier mismatch)', () => {
    const p = makePassenger({
      operatingCarrier: 'LH', operatingAlliance: 'star_alliance',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('star_gold');
    // star_gold does not meet oneworld_sapphire tier → no fallback signal fires
    // (this is different from oneworld_sapphire card + LH flight, which WOULD fire)
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeSchengen(), { now: NOW });
    assert.equal(r.status, 'denied');
  });

  test('A11b: oneworld Sapphire card + LH (star) flight + Finnair Lounge → not_applicable', () => {
    // Extra coverage: user has qualifying oneworld tier but flight is Star Alliance
    const p = makePassenger({
      operatingCarrier: 'LH', operatingAlliance: 'star_alliance',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeSchengen(), { now: NOW });
    assert.equal(r.status, 'not_applicable');
    assert.equal(r.source, 'alliance_mismatch');
  });
});

// ─── B1–B7: Restricted paid channel (Finnair Silver discount) ────────────────

// Mirrors DB post-Phase 21b: lounge id=3 has three channels — alliance_status,
// airline_own with cabin condition, and paid restricted to oneworld_ruby + AY.
function makeFinnairLoungeSchengenWithPaid(): LoungeInput {
  return makeLounge([
    makeChannel('alliance_status', 'all_alliance', [
      makeRule({ minAllianceTier: 'oneworld_sapphire', confidence: 0.99, priority: 100 }),
    ], 3),
    makeChannel('airline_own', null, [
      makeRule({
        carrierRestriction: ['AY'],
        conditions: { op: 'in', field: 'passenger.cabin', values: ['business', 'first'] },
        confidence: 0.95, priority: 90,
      }),
    ], 41),
    makeChannel('paid', null, [
      makeRule({
        minAllianceTier: 'oneworld_ruby',
        carrierRestriction: ['AY'],
        confidence: 0.9, priority: 50,
      }),
    ], 60),
  ], { id: 3, name: 'Finnair Lounge', area: 'schengen' });
}

function makeFinnairLoungeNonSchengenWithPaid(): LoungeInput {
  return makeLounge([
    makeChannel('alliance_status', 'all_alliance', [
      makeRule({ minAllianceTier: 'oneworld_sapphire', confidence: 0.99, priority: 100 }),
    ], 2),
    makeChannel('airline_own', null, [
      makeRule({
        carrierRestriction: ['AY'],
        conditions: { op: 'in', field: 'passenger.cabin', values: ['business', 'first'] },
        confidence: 0.95, priority: 90,
      }),
    ], 40),
    makeChannel('paid', null, [
      makeRule({
        minAllianceTier: 'oneworld_ruby',
        carrierRestriction: ['AY'],
        confidence: 0.9, priority: 50,
      }),
    ], 59),
  ], { id: 2, name: 'Finnair Lounge', area: 'non_schengen' });
}

describe('Phase 21b — Finnair Lounge restricted paid (Silver + AY)', () => {

  test('B1: AY Silver (oneworld_ruby) + AY Economy → paid_available', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld', cabin: 'economy',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_ruby');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeSchengenWithPaid(), { now: NOW });
    assert.equal(r.status, 'paid_available');
  });

  test('B2: no status + AY Economy → denied (paid requires ruby tier — not open walk-in)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld', cabin: 'economy',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const r = evaluateLoungeAccess(p, null, makeFinnairLoungeSchengenWithPaid(), { now: NOW });
    assert.equal(r.status, 'denied');
  });

  test('B3: BA Silver (oneworld_ruby) + BA flight to LHR + Finnair Lounge non-Schengen → denied (carrier ≠ AY, tier below sapphire)', () => {
    // BA791 HEL→LHR is a natural non-Schengen BA route; use the non-Schengen
    // fixture so the zone check does not short-circuit before the paid rule.
    const p = makePassenger({
      operatingCarrier: 'BA', operatingAlliance: 'oneworld', cabin: 'economy',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false,
    });
    const s = makeStatus('oneworld_ruby');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeNonSchengenWithPaid(), { now: NOW });
    assert.equal(r.status, 'denied');
  });

  test('B4: AY Silver + AY-Schengen flight (HEL→FRA) + Finnair Lounge non-Schengen → physically_unreachable', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld', cabin: 'economy',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_ruby');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeNonSchengenWithPaid(), { now: NOW });
    assert.equal(r.status, 'physically_unreachable');
    assert.equal(r.source, 'schengen_zone_check');
  });

  test('B5: AY Silver + AY-Schengen flight + Finnair Lounge Schengen (id=3) → paid_available', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld', cabin: 'economy',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_ruby');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeSchengenWithPaid(), { now: NOW });
    assert.equal(r.status, 'paid_available');
  });

  test('B6 (regression): AY Gold + AY Economy → allowed via alliance_status (paid rule exists but does not fire)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld', cabin: 'economy',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeSchengenWithPaid(), { now: NOW });
    assert.equal(r.status, 'allowed');
    assert.match(r.reason, /oneworld_sapphire/);
  });

  test('B7 (regression): AY Silver + AY Business → allowed via airline_own (cabin match wins over paid)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld', cabin: 'business',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_ruby');
    const r = evaluateLoungeAccess(p, s, makeFinnairLoungeSchengenWithPaid(), { now: NOW });
    assert.equal(r.status, 'allowed');
  });
});
