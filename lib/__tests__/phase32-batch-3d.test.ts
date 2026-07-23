/**
 * Phase 32 (Batch 3d): 4 Ryhmä 1 Nordic lounges.
 *
 * All 4 already list AY directly — this batch is entirely positive-control
 * from §36's perspective. Tests focus on:
 *   N1  Bergen (AY on carrier list)
 *   N2  Saga Lounge new-carrier coverage (AS = Alaska via Phase 30)
 *   N3  BLL union dedup (King Amlet: [AY,BA])
 *   N4  Walk-in fallback at SVG North Sea
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T10:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'economy', departureAirport: 'BGO', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'NO', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput { return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null, ...o }; }
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput { return { id, channelType: t, allianceAccess: a, rules: r }; }
function ryhma1(carriers: string[], baseId: number): ChannelInput[] {
  return [
    makeChannel('alliance_status', 'carrier_specific', [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, confidence: 0.95 })], baseId),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.9 })], baseId + 1),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85 })], baseId + 2),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8 })],  baseId + 3),
    makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50 })], baseId + 4),
  ];
}

const Bergen   = (): LoungeInput => ({ id: 700, name: 'Bergen Lounge',          terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AY', 'IB'],             800), exceptions: [] });
const Saga     = (): LoungeInput => ({ id: 701, name: 'Icelandair Saga Lounge', terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AS', 'AA', 'BA', 'AY'], 805), exceptions: [] });
const Amlet    = (): LoungeInput => ({ id: 702, name: 'King Amlet Lounge',      terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AY', 'BA'],             810), exceptions: [] });
const NorthSea = (): LoungeInput => ({ id: 703, name: 'North Sea Lounge',       terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AY'],                   815), exceptions: [] });

describe('Phase 32 (Batch 3d) — Nordic Ryhmä 1', () => {

  test('N1: AY Sapphire on AY BGO→HEL → Bergen Lounge allowed', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Bergen(), { now: NOW }).status, 'allowed');
  });

  test('N2: AS Sapphire on AS KEF→SEA → Saga Lounge allowed (AS = Alaska, oneworld member Phase 30)', () => {
    const p = makePassenger({ operatingCarrier: 'AS', marketingCarrier: 'AS',
      departureAirport: 'KEF', departureCountryCode: 'IS',
      arrivalAirport: 'SEA', arrivalCountryCode: 'US', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Saga(), { now: NOW }).status, 'allowed');
  });

  test('N3: BA Sapphire on BA BLL→LHR → King Amlet Lounge allowed (BLL scrape dupe union)', () => {
    const p = makePassenger({ operatingCarrier: 'BA', marketingCarrier: 'BA',
      departureAirport: 'BLL', departureCountryCode: 'DK',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Amlet(), { now: NOW }).status, 'allowed');
  });

  test('N4: walk-in on AY SVG→HEL → North Sea Lounge paid_available', () => {
    const p = makePassenger({ departureAirport: 'SVG', departureCountryCode: 'NO' });
    assert.equal(evaluateLoungeAccess(p, null, NorthSea(), { now: NOW }).status, 'paid_available');
  });
});
