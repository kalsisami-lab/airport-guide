/**
 * Phase 25: Oslo-Gardermoen (OSL) lounges — the PP-negative case.
 *
 * OSL is the first Nordic hub where Priority Pass does NOT work. A PP-only
 * card holder gets `paid_available` at OSL Lounge (walk-in fallback) and
 * `denied` at OSL Premium (no walk-in). Compare to Phase 23 AGP and Phase
 * 24 CPH Aspire/Carlsberg where PP → `allowed`.
 *
 * Amex Platinum is the direct-Amex case: `amex_centurion` channel on both
 * lounges → Platinum reaches both via useEntitlements amex-platinum →
 * amex_centurion mapping. No PP round-trip.
 *
 * OSL Premium (Emerald, no walk-in) is the "high-tier or nothing" case:
 * Sapphire and walk-in both fall to `denied` because the paid channel is
 * absent. Sapphire holder at OSL Lounge is `allowed` (Sapphire meets
 * min_tier); Sapphire holder at Premium is `denied`.
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
    arrivalAirport:       'OSL',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    arrivalCountryCode:   'NO',
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

const ONEWORLD_CARRIERS = ['BA', 'AY', 'IB', 'QR'];

// ─── Lounge fixtures (mirror DB post-Phase 25) ──────────────────────────────

function makeOSLLounge(): LoungeInput {
  return {
    id: 36, name: 'OSL Lounge', terminalId: null,
    openingHours: 'Mon-Fri 05:30–20:30',
    area: 'schengen',
    channels: [
      makeChannel('alliance_status', 'carrier_specific', [
        makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: ONEWORLD_CARRIERS, confidence: 0.99, priority: 100 }),
      ], 135),
      makeChannel('amex_centurion', null, [makeRule({ confidence: 0.9, priority: 100 })], 136),
      makeChannel('paid',           null, [makeRule({ confidence: 0.9, priority: 50  })], 137),
      // No priority_pass / lounge_key / dragon_pass — deliberate.
    ],
    exceptions: [],
  };
}

function makeOSLPremium(): LoungeInput {
  return {
    id: 37, name: 'OSL Premium Lounge', terminalId: null,
    openingHours: 'Mon-Fri 09:00–19:00, Sat closed, Sun 12:00–19:00',
    area: 'schengen',
    channels: [
      makeChannel('alliance_status', 'carrier_specific', [
        makeRule({ minAllianceTier: 'oneworld_emerald', carrierRestriction: ONEWORLD_CARRIERS, confidence: 0.99, priority: 100 }),
      ], 138),
      makeChannel('amex_centurion', null, [makeRule({ confidence: 0.9, priority: 100 })], 139),
      // No paid channel — non-Emerald non-Amex → denied.
    ],
    exceptions: [],
  };
}

// A non-Schengen departure from OSL (e.g., OSL→LHR) for F6
function nonSchengenFromOSL(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return makePassenger({
    departureAirport:     'OSL',
    arrivalAirport:       'LHR',
    departureCountryCode: 'NO',
    arrivalCountryCode:   'GB',
    arrivalIsSchengen:    false,
    ...overrides,
  });
}

// ─── F1–F6: OSL PP-negative + Emerald-vs-Sapphire tier tests ─────────────────

describe('Phase 25 — OSL Lounge (Sapphire+walk-in) vs OSL Premium (Emerald-only)', () => {

  test('F1: AY Gold (oneworld_sapphire) + AY HEL→OSL → OSL Lounge allowed, Premium denied (Sapphire < Emerald, no walk-in)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeOSLLounge(),  { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeOSLPremium(), { now: NOW }).status, 'denied');
  });

  test('F2: AY Platinum (oneworld_emerald) + AY HEL→OSL → both allowed', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_emerald');
    assert.equal(evaluateLoungeAccess(p, s, makeOSLLounge(),  { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeOSLPremium(), { now: NOW }).status, 'allowed');
  });

  test('F3: Amex Platinum (amex_centurion + PP) + AY HEL→OSL → both allowed via amex_centurion (direct, not via PP)', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['amex_centurion', 'priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeOSLLounge(),  { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeOSLPremium(), { now: NOW, passengerCards: cards }).status, 'allowed');
  });

  test('F4: Priority Pass card only + AY HEL→OSL → OSL Lounge paid_available (walk-in fallback), Premium denied (no walk-in) — PP is NOT accepted at OSL', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeOSLLounge(),  { now: NOW, passengerCards: cards }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeOSLPremium(), { now: NOW, passengerCards: cards }).status, 'denied');
  });

  test('F5: walk-in (no cards, no status) + AY HEL→OSL → OSL Lounge paid_available, Premium denied', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, null, makeOSLLounge(),  { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeOSLPremium(), { now: NOW }).status, 'denied');
  });

  test('F6: AY Gold (Sapphire) + AY OSL→LHR (non-Schengen) → both physically_unreachable (both are Schengen-area lounges)', () => {
    const p = nonSchengenFromOSL({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeOSLLounge(),  { now: NOW }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, s, makeOSLPremium(), { now: NOW }).status, 'physically_unreachable');
  });
});
