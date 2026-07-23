/**
 * Phase 32 (Batch 3e): 8 Ryhmä 1 Americas lounges.
 *
 *   A1  DFW Plaza Premium positive control (AY only)
 *   A2  DFW The Club §36 rule (QF-only → AY added)
 *   A3  LAX Business Lounge — FJ new-carrier probe
 *   A4  ORD LOT — RJ (Royal Jordanian, seeded Batch 3a) verified
 *   A5  SEA The Club §36 rule
 *   A6  YYZ PP T1 §36 rule
 *   A7  Walk-in fallback at MIA Global Lounge
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T10:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'economy', departureAirport: 'DFW', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'US', arrivalCountryCode: 'FI',
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

const DFW_PP    = (): LoungeInput => ({ id: 1200, name: 'Plaza Premium Lounge',                   terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AY'],                                                    1300), exceptions: [] });
const DFW_Club  = (): LoungeInput => ({ id: 1201, name: 'The Club at DFW',                        terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['QF', 'AY'],                                              1305), exceptions: [] });
const LAX_Biz   = (): LoungeInput => ({ id: 1202, name: 'The Los Angeles Business Lounge',        terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AA', 'BA', 'CX', 'FJ', 'AY', 'IB', 'JL', 'QF', 'QR'],     1310), exceptions: [] });
const ORD_LOT   = (): LoungeInput => ({ id: 1203, name: 'LOT Business Lounge Chicago O\'Hare',    terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['CX', 'AY', 'IB', 'QR', 'RJ'],                             1315), exceptions: [] });
const SEA_Club  = (): LoungeInput => ({ id: 1204, name: 'The Club - SEA',                         terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['CX', 'AY'],                                              1320), exceptions: [] });
const YYZ_PP1   = (): LoungeInput => ({ id: 1205, name: 'Plaza Premium Lounge',                   terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AT', 'IB', 'AY'],                                        1325), exceptions: [] });
const MIA_Global = (): LoungeInput => ({ id: 1206, name: 'Global (Turkish Airlines) Lounge',      terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AY', 'QR'],                                             1330), exceptions: [] });

describe('Phase 32 (Batch 3e) — Americas Ryhmä 1', () => {

  test('A1: AY Sapphire on AY DFW→HEL → Plaza Premium allowed (AY only in list)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), DFW_PP(), { now: NOW }).status, 'allowed');
  });

  test('A2: AY Sapphire on AY DFW→HEL → The Club allowed (§36 — QF-only snapshot)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), DFW_Club(), { now: NOW }).status, 'allowed');
  });

  test('A3: FJ Sapphire on FJ LAX→NAN → LA Business Lounge allowed (FJ new-carrier probe, oneworld connect)', () => {
    const p = makePassenger({ operatingCarrier: 'FJ', marketingCarrier: 'FJ',
      departureAirport: 'LAX', arrivalAirport: 'NAN', arrivalCountryCode: 'FJ', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), LAX_Biz(), { now: NOW }).status, 'allowed');
  });

  test('A4: RJ Sapphire on RJ ORD→AMM → LOT Business Lounge allowed (RJ from Batch 3a — regression)', () => {
    const p = makePassenger({ operatingCarrier: 'RJ', marketingCarrier: 'RJ',
      departureAirport: 'ORD', arrivalAirport: 'AMM', arrivalCountryCode: 'JO', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), ORD_LOT(), { now: NOW }).status, 'allowed');
  });

  test('A5: AY Sapphire on AY SEA→HEL → The Club allowed (§36 — CX-only snapshot)', () => {
    const p = makePassenger({ departureAirport: 'SEA' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), SEA_Club(), { now: NOW }).status, 'allowed');
  });

  test('A6: AY Sapphire on AY YYZ→HEL → PP T1 allowed (§36 — [AT,IB] snapshot)', () => {
    const p = makePassenger({ departureAirport: 'YYZ', departureCountryCode: 'CA' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), YYZ_PP1(), { now: NOW }).status, 'allowed');
  });

  test('A7: walk-in (no status, no cards) on AY MIA→HEL → Global Lounge paid_available', () => {
    const p = makePassenger({ departureAirport: 'MIA' });
    assert.equal(evaluateLoungeAccess(p, null, MIA_Global(), { now: NOW }).status, 'paid_available');
  });
});
