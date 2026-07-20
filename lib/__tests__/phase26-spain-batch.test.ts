/**
 * Phase 26 (Batch 1): Spanish leisure airports — PMI, ALC, VLC, LPA.
 *
 * First multi-airport batch. All lounges follow the Aena Sala VIP model:
 * oneworld (carrier_specific, Sapphire+) + PP/LK/DP + walk-in paid, no
 * amex_centurion (Amex Platinum reaches these via the shared PP channel).
 *
 * Two key patterns exercised:
 *   1. AY is in every carrier_restriction list per the seeding rule
 *      (Finnair-network + seasonal oneworld.com snapshot — see §36 and
 *      the file-level comment in patch-spain-batch-phase26.ts). G1 & G2
 *      would fail without this rule, most visibly at LPA (verified by
 *      user's first-hand Winter 2026 Sala Galdos access).
 *   2. PMI has one non-Schengen lounge (Llevant) among three, so zone
 *      filtering triggers within a single airport — same shape as CPH
 *      Eventyr (Phase 24) but here the affected lounge is a PP lounge,
 *      so G4 tests both zone directions.
 *
 * G7 is the smoke test for the AT (Royal Air Maroc) airline seed: AT-
 * operated flight + oneworld Sapphire → VLC Joan Olivert `allowed`. If
 * `getAllianceForCarrier('AT')` returned null (AT not seeded), this
 * would fall through to `paid_available` and the test would fail.
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
    arrivalAirport:       'PMI',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    arrivalCountryCode:   'ES',
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

// Standard Aena channel set (mirrors AENA_CHANNELS in seed script)
function aenaChannels(carriers: string[], baseId: number): ChannelInput[] {
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

// ─── Lounge fixtures (mirror DB post-Phase 26) ──────────────────────────────

function makeLlevant(): LoungeInput {
  return {
    id: 38, name: 'Llevant Lounge', terminalId: null, openingHours: null,
    area: 'non_schengen',
    channels: aenaChannels(['AY', 'IB'], 140),
    exceptions: [],
  };
}

function makeMediterraneo(): LoungeInput {
  return {
    id: 39, name: 'Mediterraneo Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: aenaChannels(['AY', 'IB'], 145),
    exceptions: [],
  };
}

function makeValldemosa(): LoungeInput {
  return {
    id: 40, name: 'Valldemosa Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: aenaChannels(['BA', 'AY', 'IB'], 150),
    exceptions: [],
  };
}

function makeCostaBlanca(): LoungeInput {
  return {
    id: 41, name: 'Costa Blanca Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: aenaChannels(['BA', 'AY', 'IB'], 155),
    exceptions: [],
  };
}

function makeJoanOlivert(): LoungeInput {
  return {
    id: 42, name: 'Joan Olivert Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: aenaChannels(['BA', 'AY', 'IB', 'AT'], 160),
    exceptions: [],
  };
}

function makeSalaGaldos(): LoungeInput {
  return {
    id: 43, name: 'Sala Galdos Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: aenaChannels(['BA', 'AY', 'IB', 'AT'], 165),
    exceptions: [],
  };
}

// PMI departure (non-Schengen leg, e.g., PMI→LHR)
function nonSchengenFromPMI(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return makePassenger({
    departureAirport:     'PMI',
    arrivalAirport:       'LHR',
    departureCountryCode: 'ES',
    arrivalCountryCode:   'GB',
    arrivalIsSchengen:    false,
    ...overrides,
  });
}

// ─── G1–G7: Spain Batch 1 tests ─────────────────────────────────────────────

describe('Phase 26 — Spanish leisure airports (PMI, ALC, VLC, LPA)', () => {

  test('G1: AY Gold (Sapphire) + AY HEL→PMI (Schengen) → Mediterraneo & Valldemosa allowed, Llevant physically_unreachable (non-Schengen)', () => {
    // AY on both [AY,IB] and [BA,AY,IB] lists — the seeding rule in action.
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeMediterraneo(), { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeValldemosa(),   { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeLlevant(),      { now: NOW }).status, 'physically_unreachable');
  });

  test('G2: AY Gold (Sapphire) + AY HEL→LPA → Sala Galdos allowed (validates AY seeding rule + user Winter 2026 first-hand)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'LPA',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeSalaGaldos(), { now: NOW }).status, 'allowed');
  });

  test('G3: AY Gold + AY HEL→ALC / HEL→VLC → Costa Blanca allowed, Joan Olivert allowed', () => {
    const pALC = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld', arrivalAirport: 'ALC' });
    const pVLC = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld', arrivalAirport: 'VLC' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(pALC, s, makeCostaBlanca(),  { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(pVLC, s, makeJoanOlivert(),  { now: NOW }).status, 'allowed');
  });

  test('G4: PP-card + AY HEL→PMI (Schengen) → Mediterraneo/Valldemosa allowed via PP, Llevant physically_unreachable; PP + AY PMI→LHR (non-Schengen) → Llevant allowed via PP', () => {
    const cards: ChannelType[] = ['priority_pass'];

    // Schengen inbound: Llevant unreachable
    const pIn = makePassenger();
    assert.equal(evaluateLoungeAccess(pIn, null, makeMediterraneo(), { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(pIn, null, makeValldemosa(),   { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(pIn, null, makeLlevant(),      { now: NOW, passengerCards: cards }).status, 'physically_unreachable');

    // Non-Schengen outbound: Llevant reachable via PP
    const pOut = nonSchengenFromPMI();
    assert.equal(evaluateLoungeAccess(pOut, null, makeLlevant(),      { now: NOW, passengerCards: cards }).status, 'allowed');
    // And Schengen-area lounges become unreachable in the outbound leg
    assert.equal(evaluateLoungeAccess(pOut, null, makeMediterraneo(), { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(pOut, null, makeValldemosa(),   { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
  });

  test('G5: walk-in (no cards, no status) + AY HEL→PMI → Mediterraneo/Valldemosa paid_available, Llevant physically_unreachable', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, null, makeMediterraneo(), { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeValldemosa(),   { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeLlevant(),      { now: NOW }).status, 'physically_unreachable');
  });

  test('G6: BA Gold (Sapphire) + BA LHR→PMI (Schengen arrival) → Valldemosa allowed (BA on list), Mediterraneo paid_available (BA NOT on [AY,IB] list)', () => {
    const p = makePassenger({
      operatingCarrier: 'BA', operatingAlliance: 'oneworld',
      departureAirport: 'LHR', departureCountryCode: 'GB',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeValldemosa(),   { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeMediterraneo(), { now: NOW }).status, 'paid_available');
  });

  test('G7: AT (Royal Air Maroc) Gold (Sapphire) + AT CMN→VLC → Joan Olivert allowed (validates AT airline seed)', () => {
    // Smoke test for patch-seed-at-ram.ts. If AT is not seeded as oneworld,
    // operatingAlliance would still resolve here (test-provided), but a
    // production PassengerContext built via lib/normalization would show
    // operatingAlliance=null → the alliance_status match still hinges on
    // carrier_restriction containing 'AT', which it does.
    const p = makePassenger({
      operatingCarrier: 'AT', operatingAlliance: 'oneworld',
      departureAirport: 'CMN', arrivalAirport: 'VLC',
      departureCountryCode: 'MA', arrivalCountryCode: 'ES',
      arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeJoanOlivert(), { now: NOW }).status, 'allowed');
  });
});
