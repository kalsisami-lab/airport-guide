/**
 * Phase 29 (Batch 5): Baltic + Central European Finnair destinations.
 *
 * Most complex batch — first time WAW carrier-list divergence (Phase 22
 * shape × 3 lounges) and BUD Schengen/non-Schengen zone split (Phase
 * 24 shape × 4 lounges) appear in a single seed.
 *
 * Test focus (J1–J8):
 *   J1  TLL direct AY listing — Baltics smoke test (0.99 conf).
 *   J2  WAW all three lounges + AY — validates AY reaches every
 *       WAW lounge including Etiuda where AY was §36-added.
 *   J3  BUD zone split with Schengen departure — 2 Schengen `allowed`,
 *       2 non-Schengen `physically_unreachable`. Confirms §36-added AY
 *       on non-Schengen lounges (Platinum NS, Plaza Premium) does NOT
 *       leak past the zone filter for a Schengen passenger.
 *   J4  WAW carrier divergence — BA reaches Etiuda + Fantazja `allowed`
 *       but Preludium is `paid_available` (BA absent from Preludium's
 *       [AY,QR] list, walk-in fires as fallback — corrects the spec's
 *       "not_applicable" which is airport-services terminology).
 *   J5  QR on the BUD non-Schengen departure — Platinum NS + Plaza
 *       Premium `allowed` (QR on both non-Schengen lists via §36).
 *   J6  PP-card + BUD Schengen departure — Schengen lounges `allowed`,
 *       non-Schengen lounges `physically_unreachable`.
 *   J7  walk-in + WAW — all three WAW lounges `paid_available`.
 *   J8  PRG both terminals — Erste Premier (T2) + Mastercard (T1)
 *       `allowed`. Terminal filter is a known gap (§45); today both
 *       show up regardless of passenger terminal.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-22T10:00:00');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'TLL',
    arrivalAirport:       'HEL',
    sameDayDeparture:     false,
    departureCountryCode: 'EE',
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

// Standard channel set with per-lounge alliance_status confidence
// (mirrors STANDARD_CHANNELS in seed script).
function standardChannels(carriers: string[], allianceConf: 0.95 | 0.99, baseId: number): ChannelInput[] {
  return [
    makeChannel('alliance_status', 'carrier_specific', [
      makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, confidence: allianceConf, priority: 100 }),
    ], baseId),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.9,  priority: 100 })], baseId + 1),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85, priority: 100 })], baseId + 2),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8,  priority: 100 })], baseId + 3),
    makeChannel('paid',          null, [makeRule({ confidence: 0.9,  priority: 50  })], baseId + 4),
  ];
}

// ─── Lounge fixtures (mirror DB post-Phase 29) ──────────────────────────────

function makeTLL(): LoungeInput {
  return {
    id: 63, name: 'Tallinn International Business Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AY'], 0.99, 240),
    exceptions: [],
  };
}

function makeWAWEtiuda(): LoungeInput {
  return {
    id: 66, name: 'Etiuda Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['BA', 'AY', 'QR'], 0.95, 250),
    exceptions: [],
  };
}

function makeWAWFantazja(): LoungeInput {
  return {
    id: 67, name: 'Fantazja Executive Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['BA', 'AY', 'QR'], 0.99, 255),
    exceptions: [],
  };
}

function makeWAWPreludium(): LoungeInput {
  return {
    id: 68, name: 'Preludium Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AY', 'QR'], 0.99, 260),
    exceptions: [],
  };
}

function makeBUDSkyCourt(): LoungeInput {
  return {
    id: 73, name: 'SkyCourt Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AY', 'IB'], 0.99, 270),
    exceptions: [],
  };
}

function makeBUDPlatinumNS(): LoungeInput {
  return {
    id: 74, name: 'Platinum Lounge Non-Schengen', terminalId: null, openingHours: null,
    area: 'non_schengen',
    channels: standardChannels(['AA', 'AY', 'QR'], 0.95, 275),
    exceptions: [],
  };
}

function makeBUDPlatinumSchengen(): LoungeInput {
  return {
    id: 75, name: 'Platinum Lounge Schengen', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AY', 'QR'], 0.95, 280),
    exceptions: [],
  };
}

function makeBUDPlazaPremiumNS(): LoungeInput {
  return {
    id: 76, name: 'Plaza Premium Non-Schengen', terminalId: null, openingHours: null,
    area: 'non_schengen',
    channels: standardChannels(['BA', 'AY'], 0.95, 285),
    exceptions: [],
  };
}

function makePRGErstePremier(): LoungeInput {
  return {
    id: 71, name: 'Erste Premier Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AY', 'IB'], 0.99, 290),
    exceptions: [],
  };
}

function makePRGMastercard(): LoungeInput {
  return {
    id: 72, name: 'Mastercard Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: standardChannels(['AA', 'BA', 'AY', 'QR'], 0.95, 295),
    exceptions: [],
  };
}

// ─── J1–J8: Baltics + CE Batch 5 tests ──────────────────────────────────────

describe('Phase 29 — Baltic + CE Finnair destinations (WAW carrier split + BUD zone split)', () => {

  test('J1: AY Gold (Sapphire) + AY TLL→HEL → Tallinn Business Lounge allowed (direct AY listing, 0.99 conf)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeTLL(), { now: NOW }).status, 'allowed');
  });

  test('J2: AY Gold + AY WAW→HEL → Etiuda + Fantazja + Preludium all allowed (§36 rescues Etiuda; Fantazja/Preludium had AY directly)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'WAW', arrivalAirport: 'HEL',
      departureCountryCode: 'PL',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeWAWEtiuda(),    { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeWAWFantazja(),  { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeWAWPreludium(), { now: NOW }).status, 'allowed');
  });

  test('J3: AY Gold + AY BUD→HEL (Schengen departure) → 2 Schengen allowed, 2 non-Schengen physically_unreachable (§36 AY does NOT leak past zone filter)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'BUD', arrivalAirport: 'HEL',
      departureCountryCode: 'HU',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeBUDSkyCourt(),          { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeBUDPlatinumSchengen(),  { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeBUDPlatinumNS(),        { now: NOW }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, s, makeBUDPlazaPremiumNS(),    { now: NOW }).status, 'physically_unreachable');
  });

  test('J4: BA Gold (Sapphire) + BA WAW→FRA (Schengen departure) → Etiuda + Fantazja allowed, Preludium paid_available (BA absent from Preludium [AY,QR] list — walk-in fallback)', () => {
    const p = makePassenger({
      operatingCarrier: 'BA', operatingAlliance: 'oneworld',
      departureAirport: 'WAW', arrivalAirport: 'FRA',
      departureCountryCode: 'PL', arrivalCountryCode: 'DE',
      arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeWAWEtiuda(),    { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeWAWFantazja(),  { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeWAWPreludium(), { now: NOW }).status, 'paid_available');
  });

  test('J5: QR Gold + QR BUD→DOH (non-Schengen departure) → Platinum NS allowed (QR on [AA,AY,QR]), Plaza Premium paid_available (QR NOT on [BA,AY] — walk-in fallback), Schengen lounges physically_unreachable', () => {
    // Within-zone carrier discrimination: both non-Schengen lounges are
    // reachable zone-wise, but Plaza Premium's carrier list is narrower
    // and does not include QR. Same ARN Pearl T2/C37 pattern applied to
    // the non-Schengen sector at BUD.
    const p = makePassenger({
      operatingCarrier: 'QR', operatingAlliance: 'oneworld',
      departureAirport: 'BUD', arrivalAirport: 'DOH',
      departureCountryCode: 'HU', arrivalCountryCode: 'QA',
      arrivalIsSchengen: false,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeBUDPlatinumNS(),        { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeBUDPlazaPremiumNS(),    { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, s, makeBUDSkyCourt(),          { now: NOW }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, s, makeBUDPlatinumSchengen(),  { now: NOW }).status, 'physically_unreachable');
  });

  test('J6: PP-card + AY BUD→HEL (Schengen) → Schengen lounges allowed via PP, non-Schengen lounges physically_unreachable', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'BUD', arrivalAirport: 'HEL',
      departureCountryCode: 'HU',
    });
    const cards: ChannelType[] = ['priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeBUDSkyCourt(),          { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeBUDPlatinumSchengen(),  { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeBUDPlatinumNS(),        { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
    assert.equal(evaluateLoungeAccess(p, null, makeBUDPlazaPremiumNS(),    { now: NOW, passengerCards: cards }).status, 'physically_unreachable');
  });

  test('J7: walk-in (no cards, no status) + AY WAW→HEL → all 3 WAW lounges paid_available', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'WAW', arrivalAirport: 'HEL',
      departureCountryCode: 'PL',
    });
    assert.equal(evaluateLoungeAccess(p, null, makeWAWEtiuda(),    { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeWAWFantazja(),  { now: NOW }).status, 'paid_available');
    assert.equal(evaluateLoungeAccess(p, null, makeWAWPreludium(), { now: NOW }).status, 'paid_available');
  });

  test('J8: AY Gold + AY PRG→HEL → Erste Premier (T2) + Mastercard (T1) both allowed (terminal filter is §45 gap — both surface today)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'PRG', arrivalAirport: 'HEL',
      departureCountryCode: 'CZ',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makePRGErstePremier(), { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makePRGMastercard(),   { now: NOW }).status, 'allowed');
  });
});
