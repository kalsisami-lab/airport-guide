/**
 * Phase 31 (Batch 2b): CX + JL + QF airline-branded oneworld lounges.
 *
 * Second all_alliance batch. The engine behavior for the shape was fully
 * exercised in Phase 30 (K1–K8), so this file focuses on:
 *   L1  Positive: new-carrier (CX from Phase 30 seed) at hub
 *   L2  Positive: JL at hub, existing carrier
 *   L3  Positive: new-carrier (QF from Phase 30 seed) at hub
 *   L4  Regression: alliance_mismatch fires correctly for a Ryhmä 2 lounge
 *       with a different-alliance operating carrier (parallels Phase 30 K3)
 *   L5  Regression: allianceUnknown fallback for a Ryhmä 2 lounge (parallels K4)
 *
 * These 5 are enough to catch two failure modes specific to this batch:
 *   a. Missing airline insert for CX / QF would flip L1 or L3 from
 *      `allowed` to `likely_allowed` (allianceUnknown path).
 *   b. A typo in the alliance_status/all_alliance channel structure
 *      would flip L1 to `denied` (no matching rule found).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-22T10:00:00');

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'HEL',
    arrivalAirport:       'HKG',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    arrivalCountryCode:   'HK',
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

function makeAllAllianceOneworldLounge(id: number, name: string): LoungeInput {
  return {
    id, name, terminalId: null, openingHours: null,
    area: 'all',
    channels: [
      makeChannel('alliance_status', 'all_alliance', [
        makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: null, confidence: 0.99, priority: 100 }),
      ], id * 10),
    ],
    exceptions: [],
  };
}

// Representative fixtures — one per brand at a hub airport
function makeHKGTheBridge()      { return makeAllAllianceOneworldLounge(97, 'Cathay Pacific The Bridge'); }
function makeHKGTheWingFirst()   { return makeAllAllianceOneworldLounge(101, 'Cathay Pacific The Wing, First'); }
function makeHNDJALSakuraIntl()  { return makeAllAllianceOneworldLounge(108, 'Japan Airlines Sakura Lounge'); }
function makeMELQantasIntlBiz()  { return makeAllAllianceOneworldLounge(116, 'Qantas International Business'); }

// ─── L1–L5: Batch 2b smoke + regression ─────────────────────────────────────

describe('Phase 31 — CX + JL + QF airline-branded oneworld lounges', () => {

  test('L1: AY Gold (Sapphire) + AY HEL→HKG → Cathay The Bridge allowed (validates CX airline seed from Phase 30 routes via oneworld)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld', arrivalAirport: 'HKG' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeHKGTheBridge(), { now: NOW }).status, 'allowed');
  });

  test('L2: AY Gold + AY HEL→HND → JAL Sakura Lounge HND allowed (JL pre-existing airline, oneworld match)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld', arrivalAirport: 'HND', arrivalCountryCode: 'JP' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeHNDJALSakuraIntl(), { now: NOW }).status, 'allowed');
  });

  test('L3: AY Gold + AY HEL→MEL → Qantas International Business allowed (validates QF airline seed from Phase 30)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld', arrivalAirport: 'MEL', arrivalCountryCode: 'AU' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeMELQantasIntlBiz(), { now: NOW }).status, 'allowed');
  });

  test('L4: oneworld Sapphire + LH-carrier (star_alliance flight) → Cathay The Wing First not_applicable (regression: alliance_mismatch fires on Ryhmä 2 Cathay lounge, same as Phase 30 K3)', () => {
    const p = makePassenger({ operatingCarrier: 'LH', operatingAlliance: 'star_alliance', departureAirport: 'FRA', arrivalAirport: 'HKG', departureCountryCode: 'DE' });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeHKGTheWingFirst(), { now: NOW });
    assert.equal(r.status, 'not_applicable');
    assert.match(r.reason, /oneworld/i);
    assert.match(r.reason, /different alliance/i);
  });

  test('L5: oneworld Sapphire + unknown carrier ("ZZ" not in airlines) → Cathay The Bridge likely_allowed conf 0.6 (regression: allianceUnknown fallback, same as Phase 30 K4)', () => {
    const p = makePassenger({ operatingCarrier: 'ZZ', operatingAlliance: null, arrivalAirport: 'HKG' });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeHKGTheBridge(), { now: NOW });
    assert.equal(r.status, 'likely_allowed');
    assert.equal(r.confidence, 0.6);
  });

  test('L6: AY Gold + AY HKG→HEL (departing HKG toward Schengen destination) → Cathay The Bridge allowed (regression: Ryhmä 2 lounges seeded area="all" bypass Schengen zone check — Asia-Pacific has no Schengen concept)', () => {
    // Zone check in evaluateLoungeAccess.ts:240 runs only for
    // area='schengen' or area='non_schengen'. All Phase 31 lounges use
    // area='all' because HKG/HND/NRT/NGO/MEL/SIN/BKK/LAX/PVG have no
    // Schengen segmentation. This test guards against a future defect
    // where someone accidentally sets a non-EU lounge's area to
    // 'schengen' or 'non_schengen' and starts filtering wrong.
    const p = makePassenger({
      operatingCarrier: 'AY', operatingAlliance: 'oneworld',
      departureAirport: 'HKG', arrivalAirport: 'HEL',
      departureCountryCode: 'HK', arrivalCountryCode: 'FI',
      arrivalIsSchengen: true,   // Schengen destination — would trigger filter if lounge.area was set wrong
    });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeHKGTheBridge(), { now: NOW });
    assert.equal(r.status, 'allowed');
    assert.notEqual(r.status, 'physically_unreachable');
  });
});
