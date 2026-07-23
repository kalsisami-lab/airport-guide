/**
 * Phase 32 (Ryhmä 3 batch): 6 AMBIG contract oneworld lounges.
 *
 * Ryhmä 3 = fixed carrier list, no §36. Tests verify:
 *   R1  MUC Air France KLM [AY,IB] — AY on list → allowed
 *   R2  MUC Air France KLM [AY,IB] — BA (oneworld but NOT on list) → not_applicable
 *       (this is the key Ryhmä 3 property — no oneworld-fallback to carriers
 *        outside the contract)
 *   R3  DUB Aer Lingus [BA,IB] — BA on list → allowed
 *   R4  CDG Air France [JL] — JL on list → allowed
 *   R5  CDG Air France [JL] — AY (Finnair, not on list) → not_applicable (no §36!)
 *   R6  PVG No.77 China Eastern PP [AY,IB] — AY on list → allowed
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T10:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'MUC', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'DE', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput { return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null, ...o }; }
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput { return { id, channelType: t, allianceAccess: a, rules: r }; }
function ryhma3(carriers: string[], baseId: number): ChannelInput[] {
  return [makeChannel('alliance_status', 'carrier_specific',
    [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, confidence: 0.95 })], baseId)];
}

const MUC_AFKLM       = (): LoungeInput => ({ id: 1100, name: 'Air France KLM Lounge',                         terminalId: null, openingHours: null, area: 'all', channels: ryhma3(['AY', 'IB'], 1200), exceptions: [] });
const DUB_AerLingus   = (): LoungeInput => ({ id: 1101, name: 'Aer Lingus Lounge',                             terminalId: null, openingHours: null, area: 'all', channels: ryhma3(['BA', 'IB'], 1210), exceptions: [] });
const CDG_AirFrance   = (): LoungeInput => ({ id: 1102, name: 'Air France Lounge',                             terminalId: null, openingHours: null, area: 'all', channels: ryhma3(['JL'],       1220), exceptions: [] });
const PVG_ChinaEastPP = (): LoungeInput => ({ id: 1103, name: 'No. 77 China Eastern Plaza Premium Lounge',     terminalId: null, openingHours: null, area: 'all', channels: ryhma3(['AY', 'IB'], 1230), exceptions: [] });

describe('Phase 32 (Ryhmä 3) — AMBIG contract lounges', () => {

  test('R1: AY Sapphire on AY MUC→HEL → Air France KLM allowed (AY on contract list)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), MUC_AFKLM(), { now: NOW }).status, 'allowed');
  });

  test('R2: BA Sapphire on BA MUC→LHR → Air France KLM NOT allowed (BA is oneworld but NOT on [AY,IB] contract — no §36 fallback)', () => {
    const p = makePassenger({ operatingCarrier: 'BA', marketingCarrier: 'BA',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), MUC_AFKLM(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('R3: BA Sapphire on BA DUB→LHR → Aer Lingus Lounge allowed (BA on list)', () => {
    const p = makePassenger({ operatingCarrier: 'BA', marketingCarrier: 'BA',
      departureAirport: 'DUB', departureCountryCode: 'IE',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), DUB_AerLingus(), { now: NOW }).status, 'allowed');
  });

  test('R4: JL Sapphire on JL CDG→NRT → Air France Lounge allowed (JL on list)', () => {
    const p = makePassenger({ operatingCarrier: 'JL', marketingCarrier: 'JL',
      departureAirport: 'CDG', departureCountryCode: 'FR',
      arrivalAirport: 'NRT', arrivalCountryCode: 'JP', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), CDG_AirFrance(), { now: NOW }).status, 'allowed');
  });

  test('R5: AY Sapphire on AY CDG→HEL → Air France Lounge NOT allowed (AY not on [JL] contract — regression: NO §36)', () => {
    // Critical Ryhmä 3 test: without §36, the AY passenger who WOULD get in via
    // §36 in a Ryhmä 1 lounge is correctly denied here — contract list is truth.
    const p = makePassenger({ departureAirport: 'CDG', departureCountryCode: 'FR' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), CDG_AirFrance(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('R6: AY Sapphire on AY PVG→HEL → No.77 China Eastern PP allowed (AY on list)', () => {
    const p = makePassenger({ departureAirport: 'PVG', departureCountryCode: 'CN' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), PVG_ChinaEastPP(), { now: NOW }).status, 'allowed');
  });
});
