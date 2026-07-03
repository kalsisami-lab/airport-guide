/**
 * Phase 23: Málaga (AGP) Sala VIP.
 *
 * Negative test case: AGP has NO oneworld-affiliated lounge (verified via
 * oneworld.com/airport-lounge-results?location=AGP). The critical assertion
 * is that a Finnair Plus Gold (oneworld Sapphire) passenger on an AY flight
 * gets `paid_available` at Sala VIP, NOT `allowed`.
 *
 * If the engine ever accidentally granted oneworld status access at
 * non-oneworld lounges, test D4 would fail. This guards against a
 * false-positive scenario where alliance-status "leaks" to unaffiliated
 * lounges.
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
    departureAirport:     'AGP',
    arrivalAirport:       'HEL',
    sameDayDeparture:     false,
    departureCountryCode: 'ES',
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
    confidence: 0.9, minAllianceTier: null, carrierRestriction: null, conditions: null,
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

// Mirrors DB post-Phase 23. Deliberately NO alliance_status channel.
function makeSalaVIP(): LoungeInput {
  return {
    id: 31, name: 'Sala VIP', terminalId: null,
    openingHours: 'Daily 05:30–22:30',
    area: 'schengen',
    channels: [
      makeChannel('priority_pass', null, [makeRule({ confidence: 0.9,  priority: 100 })], 111),
      makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85, priority: 100 })], 112),
      makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8,  priority: 100 })], 113),
      makeChannel('paid',          null, [makeRule({ confidence: 0.9,  priority: 50  })], 114),
    ],
    exceptions: [],
  };
}

// ─── D1–D6: AGP tests ────────────────────────────────────────────────────────

describe('Phase 23 — AGP Sala VIP (no oneworld affiliation)', () => {

  test('D1: Priority Pass card + AY-Schengen flight → allowed via PP', () => {
    const p = makePassenger();
    const r = evaluateLoungeAccess(p, null, makeSalaVIP(), {
      now: NOW, passengerCards: ['priority_pass'] as ChannelType[],
    });
    assert.equal(r.status, 'allowed');
    assert.equal(r.accessVia, 'Priority Pass');
  });

  test('D2: Amex Platinum (priority_pass + amex_centurion cards) + AY → allowed via PP', () => {
    // Amex Platinum's `loungeAccess: ['priority-pass', 'amex-platinum']` in
    // data/creditCards.ts maps to both channels in the payload. Sala VIP has
    // only priority_pass, so PP fires and amex_centurion is unused.
    const p = makePassenger();
    const cards: ChannelType[] = ['priority_pass', 'amex_centurion'];
    const r = evaluateLoungeAccess(p, null, makeSalaVIP(), { now: NOW, passengerCards: cards });
    assert.equal(r.status, 'allowed');
    assert.equal(r.accessVia, 'Priority Pass');
  });

  test('D3: walk-in (no cards, no status) + AY → paid_available', () => {
    const p = makePassenger();
    const r = evaluateLoungeAccess(p, null, makeSalaVIP(), { now: NOW });
    assert.equal(r.status, 'paid_available');
  });

  test('D4 (critical): Finnair Plus Gold (oneworld_sapphire) + AY-Schengen flight → paid_available, NOT allowed', () => {
    // Guards against oneworld-status "leaking" into non-oneworld lounges.
    // Sala VIP has no alliance_status channel, so oneworld status confers
    // nothing; the walk-in paid fallback fires instead.
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeSalaVIP(), { now: NOW });
    assert.notEqual(r.status, 'allowed', 'oneworld status must NOT auto-grant access at non-oneworld lounges');
    assert.equal(r.status, 'paid_available');
  });

  test('D5: AY Gold + AGP→HEL (Schengen) → paid_available (zone matches)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'HEL', arrivalCountryCode: 'FI', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeSalaVIP(), { now: NOW });
    assert.equal(r.status, 'paid_available');
  });

  test('D6: AY Gold + AGP→LHR (non-Schengen) → physically_unreachable (Schengen-lounge, non-Schengen flight)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false,
    });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeSalaVIP(), { now: NOW });
    assert.equal(r.status, 'physically_unreachable');
    assert.equal(r.source, 'schengen_zone_check');
  });
});
