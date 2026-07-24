/**
 * DEL + TLV seed regression (scraped-but-unseeded gap closed).
 *
 *   D1  AY Sapphire on AY DEL→HEL → Encalm Prive allowed (positive control — AY listed)
 *   D2  QR Sapphire on QR DEL→DOH → Encalm Prive allowed (QR on list)
 *   T1  AT Sapphire on AT TLV→CMN → Dan Lounge allowed (§36 [AT,AY])
 *   T2  AY Sapphire on AY TLV→HEL → Dan Lounge allowed (§36 added AY)
 *   T3  BA Sapphire on BA TLV→LHR → Layam Lounge - Pier C allowed
 *   T4  Non-oneworld (LH) TLV → Layam Lounge NOT allowed (rule silent for LH)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-24T12:00:00');

function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'DEL', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'IN', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput {
  return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99,
    minAllianceTier: null, carrierRestriction: null, conditions: null, ...o };
}
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput {
  return { id, channelType: t, allianceAccess: a, rules: r };
}
function ryhma1(carriers: string[], baseId: number): ChannelInput[] {
  return [
    makeChannel('alliance_status', 'carrier_specific',
      [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, confidence: 0.95 })], baseId),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.9 })], baseId + 1),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85 })], baseId + 2),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8 })], baseId + 3),
    makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50 })], baseId + 4),
  ];
}

const DEL_Encalm  = (): LoungeInput => ({ id: 8000, name: 'Encalm Prive Lounge',        terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['BA','CX','AY','JL','WY','QR'], 8100), exceptions: [] });
const TLV_Dan     = (): LoungeInput => ({ id: 8001, name: 'Dan Lounge',                 terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AT','AY'], 8110), exceptions: [] });
const TLV_Layam   = (): LoungeInput => ({ id: 8002, name: 'Layam Lounge - Pier C',      terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['BA','IB','AY'], 8120), exceptions: [] });

describe('DEL + TLV seed (scraped-but-unseeded gap)', () => {

  test('D1: AY Sapphire on AY DEL→HEL → Encalm Prive allowed (positive control — AY listed)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), DEL_Encalm(), { now: NOW }).status, 'allowed');
  });

  test('D2: QR Sapphire on QR DEL→DOH → Encalm Prive allowed (QR on 6-carrier list)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      arrivalAirport: 'DOH', arrivalCountryCode: 'QA', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), DEL_Encalm(), { now: NOW }).status, 'allowed');
  });

  test('T1: AT Sapphire on AT TLV→CMN → Dan Lounge allowed (positive control — AT listed)', () => {
    const p = makePassenger({ operatingCarrier: 'AT', marketingCarrier: 'AT',
      departureAirport: 'TLV', departureCountryCode: 'IL',
      arrivalAirport: 'CMN', arrivalCountryCode: 'MA', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), TLV_Dan(), { now: NOW }).status, 'allowed');
  });

  test('T2: AY Sapphire on AY TLV→HEL → Dan Lounge allowed (§36 added AY to [AT])', () => {
    const p = makePassenger({ departureAirport: 'TLV', departureCountryCode: 'IL' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), TLV_Dan(), { now: NOW }).status, 'allowed');
  });

  test('T3: BA Sapphire on BA TLV→LHR → Layam Lounge - Pier C allowed', () => {
    const p = makePassenger({ operatingCarrier: 'BA', marketingCarrier: 'BA',
      departureAirport: 'TLV', departureCountryCode: 'IL',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), TLV_Layam(), { now: NOW }).status, 'allowed');
  });

  test('T4: LH (Star) TLV→FRA → Layam Lounge NOT allowed (LH not on [BA,IB,AY] list, no §36 for non-oneworld)', () => {
    const p = makePassenger({ operatingCarrier: 'LH', marketingCarrier: 'LH', operatingAlliance: 'star_alliance',
      departureAirport: 'TLV', departureCountryCode: 'IL',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), TLV_Layam(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });
});
