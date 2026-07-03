/**
 * Phase 22: Stockholm-Arlanda (ARN) lounges.
 *
 * Precision-critical: Pearl Lounge T2 (BA/AY/IB) and Pearl Lounge C37 (BA/QR)
 * have DIFFERENT oneworld carrier lists. An AY passenger is `allowed` at T2
 * but not at C37; a QR passenger is `allowed` at C37 but not at T2. BA is on
 * both lists.
 *
 * When the carrier_specific alliance rule doesn't match, the paid channel
 * (priority 50, unrestricted walk-in) fires as fallback → paid_available for
 * the Pearl lounges. The Amex Lounge has no PP/paid channel → denied for
 * anyone without an Amex card.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-03T10:00:00');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'ARN',
    arrivalAirport:       'HEL',
    sameDayDeparture:     false,
    departureCountryCode: 'SE',
    arrivalCountryCode:   'FI',
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

// ─── Lounge fixtures (mirror DB post-Phase 22) ──────────────────────────────

function makePearlT2(): LoungeInput {
  return {
    id: 28, name: 'Pearl Lounge Terminal 2', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: [
      makeChannel('alliance_status', 'carrier_specific', [
        makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['BA', 'AY', 'IB'], confidence: 0.99, priority: 100 }),
      ], 100),
      makeChannel('priority_pass', null, [makeRule({ confidence: 0.9, priority: 100 })], 101),
      makeChannel('lounge_key',    null, [makeRule({ confidence: 0.9, priority: 100 })], 102),
      makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.9, priority: 100 })], 103),
      makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50 })],  104),
    ],
    exceptions: [],
  };
}

function makePearlC37(): LoungeInput {
  return {
    id: 29, name: 'Pearl Lounge Gate C37', terminalId: null,
    openingHours: 'Daily 06:30–20:30',
    area: 'schengen',
    channels: [
      makeChannel('alliance_status', 'carrier_specific', [
        makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['BA', 'QR'], confidence: 0.99, priority: 100 }),
      ], 105),
      makeChannel('priority_pass', null, [makeRule({ confidence: 0.9, priority: 100 })], 106),
      makeChannel('lounge_key',    null, [makeRule({ confidence: 0.9, priority: 100 })], 107),
      makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.9, priority: 100 })], 108),
      makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50 })],  109),
    ],
    exceptions: [],
  };
}

function makeAmexLounge(): LoungeInput {
  return {
    id: 30, name: 'American Express Lounge', terminalId: null,
    openingHours: 'Daily 05:00–19:30',
    area: 'schengen',
    channels: [
      makeChannel('amex_centurion', null, [makeRule({ confidence: 0.9, priority: 100 })], 110),
    ],
    exceptions: [],
  };
}

// ─── C1–C8: ARN precision tests ──────────────────────────────────────────────

describe('Phase 22 — Pearl T2 vs Pearl C37 carrier-list divergence', () => {

  test('C1: AY Gold (oneworld_sapphire) + AY-Schengen flight → T2 allowed, C37 paid_available, Amex Lounge denied', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makePearlT2(),    { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makePearlC37(),   { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, s, makeAmexLounge(), { now: NOW }).status, 'denied');
  });

  test('C2: BA Silver+Gold hybrid (oneworld_sapphire) + BA-Schengen flight → both Pearl allowed', () => {
    const p = makePassenger({ operatingCarrier: 'BA', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makePearlT2(),  { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makePearlC37(), { now: NOW }).status, 'allowed');
  });

  test('C3: QR (oneworld_sapphire) + QR-Schengen flight → C37 allowed, T2 paid_available', () => {
    const p = makePassenger({ operatingCarrier: 'QR', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makePearlT2(),  { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, s, makePearlC37(), { now: NOW }).status, 'allowed');
  });

  test('C4: Priority Pass card + AY flight → both Pearl allowed via PP, Amex Lounge denied', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, null, makePearlT2(),    { now: NOW, passengerCards: ['priority_pass'] as ChannelType[] }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makePearlC37(),   { now: NOW, passengerCards: ['priority_pass'] as ChannelType[] }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeAmexLounge(), { now: NOW, passengerCards: ['priority_pass'] as ChannelType[] }).status, 'denied');
  });

  test('C5: Amex Platinum (amex_centurion + PP cards) + AY flight → all three allowed', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['amex_centurion', 'priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makePearlT2(),    { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makePearlC37(),   { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeAmexLounge(), { now: NOW, passengerCards: cards }).status, 'allowed');
  });

  test('C6: walk-in (no cards, no status) + AY → Pearl-lounges paid_available, Amex Lounge denied', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, null, makePearlT2(),    { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makePearlC37(),   { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeAmexLounge(), { now: NOW }).status, 'denied');
  });

  test('C7: AY Silver (oneworld_ruby, below sapphire) + AY-Schengen → Pearl paid_available, Amex denied', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_ruby');
    assert.equal(evaluateLoungeAccess(p, s, makePearlT2(),    { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, s, makePearlC37(),   { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, s, makeAmexLounge(), { now: NOW }).status, 'denied');
  });

  test('C8 (zone): AY sapphire + ARN→LHR (non-Schengen) → all three physically_unreachable', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makePearlT2(),    { now: NOW }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, s, makePearlC37(),   { now: NOW }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, s, makeAmexLounge(), { now: NOW }).status, 'physically_unreachable');
  });
});
