/**
 * Phase 32 (Batch 3a): 19 Ryhmä 1 third-party East Asia lounges + 1 Ryhmä 2
 * at ICN. Focus of the golden set:
 *
 *   E1  Positive control — AY already on carrier list (BKK Miracle Business
 *       [BA,AY,MH,QF,QR,UL])
 *   E2  §36 in action — QR-only snapshot at BKK Miracle First; AY added
 *   E3  §36 in action — [MH,QR] → +AY at HKG Plaza Premium (West Hall)
 *   E4  Positive control at HKG — AY already in list (East Hall)
 *   E5  New carrier UL — SIN→CMB UL Sapphire → SIN Dnata allowed
 *   E6  New carrier RJ — HKG→AMM RJ Sapphire → HKG PP East Hall allowed
 *   E7  Ryhmä 2 positive — ICN→HEL AY Sapphire → oneworld Lounge allowed
 *   E8  Ryhmä 2 regression — star_alliance carrier at ICN oneworld Lounge
 *       returns not_applicable with an oneworld reason (parallels Phase 31 L4)
 *   E9  QR-native at BKK Miracle First (QR listed) — no §36 dependency
 *   E10 PP fallback — no oneworld status but Priority Pass card at BKK Miracle
 *   E11 Walk-in fallback — no status, no card → paid_available at BKK
 *
 * Semantic note: every scenario places the passenger AT the lounge's airport,
 * departing outbound. E.g. BKK Miracle Business is exercised with a
 * BKK→HEL passenger (Finnair return leg), not HEL→BKK. `evaluateLoungeAccess`
 * itself does not read departure/arrival IATAs (only operatingCarrier,
 * operatingAlliance, arrivalIsSchengen, passengerZone) so the test outcomes
 * would be identical either way — but the fixtures reflect the real
 * geometry so a reader can trust the scenario description.
 *
 * If any of E5–E6 fails, the carrier seed patch (RJ / UL into airlines) was
 * skipped or the alliance FK went wrong — allianceUnknown branch would flip
 * `allowed` to `likely_allowed`.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-22T10:00:00');

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Default passenger models a BKK→HEL leg (Finnair inbound to Helsinki from
// Bangkok — e.g. AY402). Overrides swap origin/destination for the other
// Asian hubs. In every test the passenger is AT the lounge's airport.
function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'BKK',
    arrivalAirport:       'HEL',
    sameDayDeparture:     false,
    departureCountryCode: 'TH',
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

// Ryhmä 1 channel set — mirrors RYHMA_1_CHANNELS in the seed patch.
function ryhma1Channels(carriers: string[], baseId: number): ChannelInput[] {
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

// ─── Lounge fixtures (mirror DB post-Phase 32 Batch 3a) ────────────────────

function makeBKKMiracleBusiness(): LoungeInput {
  return {
    id: 200, name: 'Miracle Business Class Lounge', terminalId: null, openingHours: null,
    area: 'all',
    channels: ryhma1Channels(['BA', 'AY', 'MH', 'QF', 'QR', 'UL'], 300),
    exceptions: [],
  };
}

function makeBKKMiracleFirst(): LoungeInput {
  return {
    id: 201, name: 'Miracle First Class Lounge', terminalId: null, openingHours: null,
    area: 'all',
    // §36 AY added to QR-only snapshot
    channels: ryhma1Channels(['QR', 'AY'], 305),
    exceptions: [],
  };
}

function makeHKGPPWestHall(): LoungeInput {
  return {
    id: 202, name: 'Plaza Premium Lounge (West Hall)', terminalId: null, openingHours: null,
    area: 'all',
    // §36 AY added to [MH,QR] snapshot
    channels: ryhma1Channels(['MH', 'QR', 'AY'], 310),
    exceptions: [],
  };
}

function makeHKGPPEastHall(): LoungeInput {
  return {
    id: 203, name: 'Plaza Premium Lounge (East Hall)', terminalId: null, openingHours: null,
    area: 'all',
    // Positive control — AY already in snapshot; RJ + UL as new-carrier list members
    channels: ryhma1Channels(['AY', 'QR', 'RJ', 'UL'], 315),
    exceptions: [],
  };
}

function makeSINDnata(): LoungeInput {
  return {
    id: 204, name: 'Dnata Lounge', terminalId: null, openingHours: null,
    area: 'all',
    // §36 AY added to UL-only snapshot — used for the UL new-carrier probe
    channels: ryhma1Channels(['UL', 'AY'], 320),
    exceptions: [],
  };
}

function makeICNoneworldLounge(): LoungeInput {
  return {
    id: 205, name: 'oneworld Lounge', terminalId: null, openingHours: null,
    area: 'all',
    // Ryhmä 2 shape — single all_alliance channel
    channels: [
      makeChannel('alliance_status', 'all_alliance', [
        makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: null, confidence: 0.99, priority: 100 }),
      ], 325),
    ],
    exceptions: [],
  };
}

// ─── E1–E11 ────────────────────────────────────────────────────────────────

describe('Phase 32 (Batch 3a) — East Asia Ryhmä 1 + ICN Ryhmä 2', () => {

  test('E1: AY Sapphire on AY BKK→HEL (at BKK) → Miracle Business allowed (positive control — AY in snapshot)', () => {
    // Passenger at BKK, departing on Finnair inbound leg to HEL
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeBKKMiracleBusiness(), { now: NOW }).status, 'allowed');
  });

  test('E2: AY Sapphire on AY BKK→HEL (at BKK) → Miracle First allowed (§36 rule — snapshot had QR only)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeBKKMiracleFirst(), { now: NOW }).status, 'allowed');
  });

  test('E3: AY Sapphire on AY HKG→HEL (at HKG) → PP Lounge (West Hall) allowed (§36 — snapshot [MH,QR])', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'HKG', departureCountryCode: 'HK',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeHKGPPWestHall(), { now: NOW }).status, 'allowed');
  });

  test('E4: AY Sapphire on AY HKG→HEL (at HKG) → PP Lounge (East Hall) allowed (positive control — AY in snapshot)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'HKG', departureCountryCode: 'HK',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeHKGPPEastHall(), { now: NOW }).status, 'allowed');
  });

  test('E5: UL Sapphire on UL SIN→CMB (at SIN, home-bound to Colombo) → SIN Dnata allowed (new-carrier probe: UL is oneworld)', () => {
    const p = makePassenger({
      operatingCarrier: 'UL', operatingAlliance: 'oneworld',
      departureAirport: 'SIN', departureCountryCode: 'SG',
      arrivalAirport: 'CMB', arrivalCountryCode: 'LK',
      arrivalIsSchengen: false,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeSINDnata(), { now: NOW }).status, 'allowed');
  });

  test('E6: RJ Sapphire on RJ HKG→AMM (at HKG, home-bound to Amman) → HKG PP East Hall allowed (new-carrier probe: RJ is oneworld)', () => {
    const p = makePassenger({
      operatingCarrier: 'RJ', operatingAlliance: 'oneworld',
      departureAirport: 'HKG', departureCountryCode: 'HK',
      arrivalAirport: 'AMM', arrivalCountryCode: 'JO',
      arrivalIsSchengen: false,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeHKGPPEastHall(), { now: NOW }).status, 'allowed');
  });

  test('E7: AY Sapphire on AY ICN→HEL (at ICN) → ICN oneworld Lounge allowed (Ryhmä 2 all_alliance)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'ICN', departureCountryCode: 'KR',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeICNoneworldLounge(), { now: NOW }).status, 'allowed');
  });

  test('E8: oneworld Sapphire on LH ICN→FRA (at ICN, star_alliance flight) → ICN oneworld Lounge not_applicable (regression: alliance_mismatch fires on Ryhmä 2)', () => {
    const p = makePassenger({
      operatingCarrier: 'LH', operatingAlliance: 'star_alliance',
      departureAirport: 'ICN', departureCountryCode: 'KR',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE',
      arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeICNoneworldLounge(), { now: NOW });
    assert.equal(r.status, 'not_applicable');
    assert.match(r.reason, /oneworld/i);
  });

  test('E9: QR Sapphire on QR BKK→DOH (at BKK, home-bound to Doha) → Miracle First allowed (QR native — no §36 dependency)', () => {
    const p = makePassenger({
      operatingCarrier: 'QR', operatingAlliance: 'oneworld',
      departureAirport: 'BKK', departureCountryCode: 'TH',
      arrivalAirport: 'DOH', arrivalCountryCode: 'QA',
      arrivalIsSchengen: false,
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeBKKMiracleFirst(), { now: NOW }).status, 'allowed');
  });

  test('E10: PP-card on AY BKK→HEL (at BKK) → Miracle Business allowed via PP (no oneworld status required)', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['priority_pass'];
    assert.equal(
      evaluateLoungeAccess(p, null, makeBKKMiracleBusiness(), { now: NOW, passengerCards: cards }).status,
      'allowed',
    );
  });

  test('E11: walk-in (no cards, no status) on AY BKK→HEL (at BKK) → Miracle First paid_available', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, null, makeBKKMiracleFirst(), { now: NOW }).status, 'paid_available');
  });
});
