/**
 * Phase 27 (Batch 2): Greek Finnair destinations — CFU, HER, RHO, JMK, SKG.
 *
 * Second multi-airport batch, all Aena/Goldair model (oneworld
 * carrier_specific + PP/LK/DP + walk-in paid). All lounges Schengen —
 * no intra-airport zone split.
 *
 * §36 rule in action:
 *   - CFU / RHO oneworld.com snapshots showed only BA in summer 2026;
 *     Finnair flies both on summer schedule. AY added per rule (H2, H3).
 *   - JMK snapshot showed IB/QR; AY added per rule.
 *   - SKG Manolis Andronikos snapshot lists AY directly — positive
 *     control that the rule is not silently expanding lists where
 *     oneworld.com already reflects reality (H1).
 *
 * H1 is the most informative single test: SKG Manolis Andronikos was
 * seeded with `[AY]` alone, matching oneworld.com. If any downstream
 * change broke Finnair-alliance handling, H1 would fail before the
 * §36-derived lounges (H2/H3) mask it.
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
    arrivalAirport:       'SKG',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    arrivalCountryCode:   'GR',
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

// Standard Greek channel set (mirrors GREEK_CHANNELS in seed script)
function greekChannels(carriers: string[], baseId: number): ChannelInput[] {
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

// ─── Lounge fixtures (mirror DB post-Phase 27) ──────────────────────────────

function makeCFUGoldair(): LoungeInput {
  return {
    id: 44, name: 'Goldair Handling Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: greekChannels(['BA', 'AY'], 170),
    exceptions: [],
  };
}

function makeHERFiloxenia(): LoungeInput {
  return {
    id: 45, name: 'Filoxenia Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: greekChannels(['BA', 'AY', 'IB'], 175),
    exceptions: [],
  };
}

function makeRHOGoldair(): LoungeInput {
  return {
    id: 46, name: 'Goldair Handling Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: greekChannels(['BA', 'AY'], 180),
    exceptions: [],
  };
}

function makeJMKCip(): LoungeInput {
  return {
    id: 47, name: 'CIP Lounge by Goldair', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: greekChannels(['AY', 'IB', 'QR'], 185),
    exceptions: [],
  };
}

function makeSKGManolisAndronikos(): LoungeInput {
  return {
    id: 48, name: 'Manolis Andronikos Skyserv Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: greekChannels(['AY'], 190),
    exceptions: [],
  };
}

function makeSKGPrimaVista(): LoungeInput {
  return {
    id: 49, name: 'Prima Vista Lounge', terminalId: null, openingHours: null,
    area: 'schengen',
    channels: greekChannels(['BA', 'AY'], 195),
    exceptions: [],
  };
}

// ─── H1–H7: Greece Batch 2 tests ────────────────────────────────────────────

describe('Phase 27 — Greek Finnair destinations (CFU, HER, RHO, JMK, SKG)', () => {

  test('H1: AY Gold (Sapphire) + AY HEL→SKG → Manolis Andronikos allowed (positive control — oneworld.com lists AY directly, §36 not over-including)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeSKGManolisAndronikos(), { now: NOW }).status, 'allowed');
  });

  test('H2: AY Gold (Sapphire) + AY HEL→CFU → Goldair allowed (§36 rule: AY added even though summer snapshot showed only BA)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'CFU',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeCFUGoldair(), { now: NOW }).status, 'allowed');
  });

  test('H3: AY Gold + AY HEL→JMK → CIP Lounge allowed (§36 rule + JMK snapshot listed IB/QR only)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      arrivalAirport: 'JMK',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeJMKCip(), { now: NOW }).status, 'allowed');
  });

  test('H4: BA Gold (Sapphire) + BA LHR→HER → Filoxenia allowed (BA on [BA,AY,IB] list)', () => {
    const p = makePassenger({
      operatingCarrier: 'BA', operatingAlliance: 'oneworld',
      departureAirport: 'LHR', arrivalAirport: 'HER',
      departureCountryCode: 'GB',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeHERFiloxenia(), { now: NOW }).status, 'allowed');
  });

  test('H5: QR Gold (Sapphire) + QR DOH→JMK → CIP Lounge allowed (QR on [AY,IB,QR] list)', () => {
    const p = makePassenger({
      operatingCarrier: 'QR', operatingAlliance: 'oneworld',
      departureAirport: 'DOH', arrivalAirport: 'JMK',
      departureCountryCode: 'QA',
    });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeJMKCip(), { now: NOW }).status, 'allowed');
  });

  test('H6: PP-card + AY HEL→SKG → both SKG lounges allowed via PP (no oneworld status required)', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeSKGManolisAndronikos(), { now: NOW, passengerCards: cards }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, null, makeSKGPrimaVista(),        { now: NOW, passengerCards: cards }).status, 'allowed');
  });

  test('H7: walk-in (no cards, no status) + AY HEL→CFU → Goldair paid_available (walk-in fallback)', () => {
    const p = makePassenger({ arrivalAirport: 'CFU' });
    assert.equal(evaluateLoungeAccess(p, null, makeCFUGoldair(), { now: NOW }).status, 'paid_available');
  });
});
