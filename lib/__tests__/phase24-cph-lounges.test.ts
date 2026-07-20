/**
 * Phase 24: Copenhagen (CPH) lounges — zone + carrier double filter.
 *
 * First lounge seed that mixes Schengen and non-Schengen lounges at the same
 * airport, so `physically_unreachable` is exercised end-to-end. Also mirrors
 * the ARN Pearl T2/C37 carrier-list divergence (Phase 22):
 *   - Danske Bank Aviator = oneworld [AY,IB]  (Schengen)
 *   - Eventyr             = oneworld [BA,QR]  (non_schengen)
 *
 * A Finnair passenger on HEL→CPH (Schengen inbound) is `allowed` at Danske
 * Bank Aviator but `physically_unreachable` at Eventyr — status is not the
 * gate here, the zone is.
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
    arrivalAirport:       'CPH',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    arrivalCountryCode:   'DK',
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

// ─── Lounge fixtures (mirror DB post-Phase 24) ──────────────────────────────

function makeDanskeBank(): LoungeInput {
  return {
    id: 32, name: 'Danske Bank Aviator Business Lounge', terminalId: null,
    openingHours: null,
    area: 'schengen',
    channels: [
      makeChannel('alliance_status', 'carrier_specific', [
        makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AY', 'IB'], confidence: 0.99, priority: 100 }),
      ], 120),
      makeChannel('lounge_key',  null, [makeRule({ confidence: 0.9,  priority: 100 })], 121),
      makeChannel('dragon_pass', null, [makeRule({ confidence: 0.8,  priority: 100 })], 122),
      makeChannel('paid',        null, [makeRule({ confidence: 0.9,  priority: 50  })], 123),
    ],
    exceptions: [],
  };
}

function makeEventyr(): LoungeInput {
  return {
    id: 33, name: 'Eventyr Lounge', terminalId: null,
    openingHours: 'Daily 05:30–20:00',
    area: 'non_schengen',
    channels: [
      makeChannel('alliance_status', 'carrier_specific', [
        makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['BA', 'QR'], confidence: 0.99, priority: 100 }),
      ], 124),
      makeChannel('priority_pass', null, [makeRule({ confidence: 0.9,  priority: 100 })], 125),
      makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85, priority: 100 })], 126),
      makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8,  priority: 100 })], 127),
      makeChannel('paid',          null, [makeRule({ confidence: 0.9,  priority: 50  })], 128),
    ],
    exceptions: [],
  };
}

function makeAspire(): LoungeInput {
  return {
    id: 34, name: 'Aspire Lounge', terminalId: null,
    openingHours: 'Daily 06:00–20:00',
    area: 'schengen',
    channels: [
      makeChannel('priority_pass', null, [makeRule({ confidence: 0.9,  priority: 100 })], 129),
      makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85, priority: 100 })], 130),
      makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8,  priority: 100 })], 131),
      makeChannel('paid',          null, [makeRule({ confidence: 0.9,  priority: 50  })], 132),
    ],
    exceptions: [],
  };
}

function makeCarlsberg(): LoungeInput {
  return {
    id: 35, name: 'Carlsberg Aviator Lounge', terminalId: null,
    openingHours: null,
    area: 'schengen',
    channels: [
      makeChannel('priority_pass', null, [makeRule({ confidence: 0.9, priority: 100 })], 133),
      makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50  })], 134),
    ],
    exceptions: [],
  };
}

// A non-Schengen departure from CPH (e.g., CPH→LHR) for BA-side tests
function nonSchengenFromCPH(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return makePassenger({
    departureAirport:     'CPH',
    arrivalAirport:       'LHR',
    departureCountryCode: 'DK',
    arrivalCountryCode:   'GB',
    arrivalIsSchengen:    false,
    ...overrides,
  });
}

// ─── E1–E7: CPH zone + carrier double-filter tests ───────────────────────────

describe('Phase 24 — CPH Schengen/non-Schengen + carrier double filter', () => {

  test('E1: AY Sapphire + AY HEL→CPH (Schengen) → Danske Bank allowed, Eventyr physically_unreachable, Aspire/Carlsberg paid_available', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeDanskeBank(), { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeEventyr(),    { now: NOW }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, s, makeAspire(),     { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, s, makeCarlsberg(),  { now: NOW }).status, 'paid_available');
  });

  test('E2: BA Emerald + BA CPH→LHR (non-Schengen) → Eventyr allowed, Schengen-lounges physically_unreachable', () => {
    const p = nonSchengenFromCPH({ operatingCarrier: 'BA', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_emerald');
    assert.equal(evaluateLoungeAccess(p, s, makeEventyr(),    { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeDanskeBank(), { now: NOW }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, s, makeAspire(),     { now: NOW }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, s, makeCarlsberg(),  { now: NOW }).status, 'physically_unreachable');
  });

  test('E3: Priority Pass card + AY HEL→CPH (Schengen) → Aspire/Carlsberg allowed, Danske Bank paid_available (no PP), Eventyr physically_unreachable', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeAspire(),     { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeCarlsberg(),  { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeDanskeBank(), { now: NOW, passengerCards: cards }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeEventyr(),    { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
  });

  test('E4: Priority Pass card + BA CPH→LHR (non-Schengen) → Eventyr allowed via PP, Schengen-lounges physically_unreachable', () => {
    const p = nonSchengenFromCPH({ operatingCarrier: 'BA', operatingAlliance: 'oneworld' });
    const cards: ChannelType[] = ['priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeEventyr(),    { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeDanskeBank(), { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, null, makeAspire(),     { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, null, makeCarlsberg(),  { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
  });

  test('E5: walk-in (no cards, no status) + AY HEL→CPH → 3 Schengen lounges paid_available, Eventyr physically_unreachable', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, null, makeDanskeBank(), { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeAspire(),     { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeCarlsberg(),  { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeEventyr(),    { now: NOW }).status, 'physically_unreachable');
  });

  test('E6: Amex Platinum (amex_centurion + PP) + AY HEL→CPH → Aspire/Carlsberg allowed via PP, Danske Bank paid_available (no PP channel), Eventyr physically_unreachable', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['amex_centurion', 'priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeAspire(),     { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeCarlsberg(),  { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeDanskeBank(), { now: NOW, passengerCards: cards }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeEventyr(),    { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
  });

  test('E7: Danske Bank Platinum (LK card) + AY HEL→CPH → Danske Bank allowed via LK, Aspire allowed via LK, Carlsberg paid_available (no LK), Eventyr physically_unreachable', () => {
    // Verifies the deliberate lounge_key inclusion on Danske Bank Aviator —
    // creditCards.ts:96 danske-platinum maps to lounge_key. This is the
    // "Danske Bank customer reaches their branded lounge" path.
    const p = makePassenger();
    const cards: ChannelType[] = ['lounge_key'];
    assert.equal(evaluateLoungeAccess(p, null, makeDanskeBank(), { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeAspire(),     { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeCarlsberg(),  { now: NOW, passengerCards: cards }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeEventyr(),    { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
  });
});
