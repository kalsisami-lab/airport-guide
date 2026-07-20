/**
 * Phase 28 (Batch 4): Portuguese + Italian Finnair destinations.
 *
 * Largest single-batch seed to date — 13 lounges across 12 airports.
 * Same channel shape as Phase 26 (Aena Sala VIP) and Phase 27
 * (Goldair/Skyserv Greek): oneworld carrier_specific + PP/LK/DP +
 * walk-in paid. §36 rule (AY in every carrier list) applied throughout.
 *
 * Test focus (I1–I8) covers three orthogonal risks:
 *   1. Positive controls where oneworld.com already lists AY (I1 VCE) —
 *      confirms §36 doesn't over-include when snapshot is complete.
 *   2. §36-derived cases where AY was rule-added (I2 OPO) — same
 *      LPA/CFU pattern.
 *   3. Zone split within one airport (I3 FAO) — CPH Eventyr shape
 *      recreated in Portugal.
 *   4. Carrier discrimination on small lists (I8 CTA [AY,IB] only) —
 *      no BA/AA fallback, so any regression in carrier matching would
 *      show as `paid_available` instead of `allowed`.
 *
 * I4 (AA at LIS) validates that American Airlines — seeded pre-batch,
 * not this phase — still routes correctly through carrier_restriction.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-20T10:00:00');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'HEL',
    arrivalAirport:       'VCE',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    arrivalCountryCode:   'IT',
    arrivalIsSchengen:    true,
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

// Standard channel set (mirrors STANDARD_CHANNELS in seed script)
function standardChannels(carriers: string[], baseId: number): ChannelInput[] {
  return [
    makeChannel('alliance_status', 'carrier_specific', [
      makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, confidence: 0.95, priority: 100 }),
    ], baseId),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.9,  priority: 100 })], baseId + 1),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85, priority: 100 })], baseId + 2),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8,  priority: 100 })], baseId + 3),
    makeChannel('paid',          null, [makeRule({ confidence: 0.9,  priority: 50  })], baseId + 4),
  ];
}

// ─── Lounge fixtures (only those tested; mirror DB post-Phase 28) ────────────

function makeVCEMarcoPolo(): LoungeInput {
  return {
    id: 56, name: 'Venice Marco Polo Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AA', 'BA', 'AY', 'IB', 'QR', 'AT'], 200),
    exceptions: [],
  };
}

function makeOPOAna(): LoungeInput {
  return {
    id: 51, name: 'ANA Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['BA', 'AY', 'IB', 'AT'], 205),
    exceptions: [],
  };
}

function makeFAOCip(): LoungeInput {
  return {
    id: 52, name: 'CIP Lounge', terminalId: null, openingHours: null,
    area: 'non_schengen',
    channels: standardChannels(['BA', 'AY'], 210),
    exceptions: [],
  };
}

function makeFAOCipSchengen(): LoungeInput {
  return {
    id: 53, name: 'CIP Lounge Schengen', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AY', 'IB'], 215),
    exceptions: [],
  };
}

function makeLISAna(): LoungeInput {
  return {
    id: 50, name: 'ANA Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AA', 'BA', 'AY', 'IB', 'QR', 'AT'], 220),
    exceptions: [],
  };
}

function makePSASalaVipGalilei(): LoungeInput {
  return {
    id: 58, name: 'Sala VIP Galilei', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['BA', 'AY', 'QR'], 225),
    exceptions: [],
  };
}

function makeCTAAngelo(): LoungeInput {
  return {
    id: 60, name: "Angelo D'Arrigo", terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AY', 'IB'], 230),
    exceptions: [],
  };
}

// ─── I1–I8: Portugal + Italy Batch 4 tests ───────────────────────────────────

describe('Phase 28 — Portuguese + Italian Finnair destinations', () => {

  test('I1: AY Gold (Sapphire) + AY HEL→VCE → Marco Polo allowed (positive control — oneworld.com lists AY directly, 6-carrier hub)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeVCEMarcoPolo(), { now: NOW }).status, 'allowed');
  });

  test('I2: AY Gold (Sapphire) + AY HEL→OPO → ANA allowed (§36 rule — AY added, snapshot did not list Finnair)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'OPO', arrivalCountryCode: 'PT',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeOPOAna(), { now: NOW }).status, 'allowed');
  });

  test('I3: AY Gold + AY FAO→HEL (Schengen departure from FAO) → CIP Schengen allowed, CIP (non-Schengen) physically_unreachable — FAO zone split, CPH Eventyr shape', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'FAO', arrivalAirport: 'HEL',
      departureCountryCode: 'PT', arrivalCountryCode: 'FI',
      arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeFAOCipSchengen(), { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeFAOCip(),         { now: NOW }).status, 'physically_unreachable');
  });

  test('I4: AA Gold (Sapphire) + AA LIS→FRA (Schengen dest) → ANA allowed (validates AA airline entry works with 6-carrier list)', () => {
    // AA is already in airlines table (id=6, oneworld). This test exercises
    // the alliance_status carrier match for AA specifically — a regression
    // in AA handling would show as `paid_available`.
    const p = makePassenger({
      operatingCarrier: 'AA', operatingAlliance: 'oneworld',
      departureAirport: 'LIS', arrivalAirport: 'FRA',
      departureCountryCode: 'PT', arrivalCountryCode: 'DE',
      arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeLISAna(), { now: NOW }).status, 'allowed');
  });

  test('I5: QR Gold (Sapphire) + QR DOH→PSA (Schengen arrival) → Sala VIP Galilei allowed (QR on [BA,AY,QR] list)', () => {
    const p = makePassenger({
      operatingCarrier: 'QR', operatingAlliance: 'oneworld',
      departureAirport: 'PSA', arrivalAirport: 'DOH',
      departureCountryCode: 'IT', arrivalCountryCode: 'QA',
      arrivalIsSchengen: false,
    });
    // Passenger is at PSA departing DOH — but PSA is Schengen area for
    // intra-Schengen; QR direct to DOH is non-Schengen departure. Use a
    // Schengen next-leg to hit the Schengen lounge.
    const pSchengen = makePassenger({
      operatingCarrier: 'QR', operatingAlliance: 'oneworld',
      departureAirport: 'PSA', arrivalAirport: 'MAD',
      departureCountryCode: 'IT', arrivalCountryCode: 'ES',
      arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    // Use the Schengen next-leg case since PSA lounge is Schengen area.
    // (The DOH-leg case would return physically_unreachable, which is
    // correct behavior but not what this test is exercising.)
    void p;  // preserved for readability; primary assertion below
    assert.equal(evaluateLoungeAccess(pSchengen, s, makePSASalaVipGalilei(), { now: NOW }).status, 'allowed');
  });

  test('I6: PP-card + AY HEL→VCE → Marco Polo allowed via PP (no status required)', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeVCEMarcoPolo(), { now: NOW, passengerCards: cards }).status, 'allowed');
  });

  test('I7: walk-in (no cards, no status) + AY HEL→VCE → Marco Polo paid_available', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, null, makeVCEMarcoPolo(), { now: NOW }).status, 'paid_available');
  });

  test('I8: AY Gold (Sapphire) + AY HEL→CTA → Angelo D\'Arrigo allowed (small [AY,IB] list — no BA/AA fallback, tightest carrier gate)', () => {
    // CTA has only [AY,IB] — no BA, no QR, no AA. If AY carrier matching
    // broke, this test would flip to `paid_available` while the wider-list
    // lounges (I1, I4) would still pass. Guards the tight-list case.
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'CTA', arrivalCountryCode: 'IT',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeCTAAngelo(), { now: NOW }).status, 'allowed');
  });
});
