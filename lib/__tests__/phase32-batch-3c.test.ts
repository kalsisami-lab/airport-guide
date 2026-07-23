/**
 * Phase 32 (Batch 3c): 33 Ryhmä 1 Central+Western Europe lounges.
 *
 * Sample surface (per-country golden case):
 *   C1  Germany  — MUC Europa Lounge positive control (AY listed)
 *   C2  Germany  — MUC Airport Lounge World §36 rule
 *   C3  France   — CDG PrimeClass §36 + non-AY oneworld path (BA)
 *   C4  Swiss    — ZRH Aspire (Dock E) non_schengen zone gate
 *   C5  Austria  — VIE Sky Lounge §36 with QR native
 *   C6  Nether.  — AMS oneworld Lounge (large carrier list) with §36
 *   C7  Belgium  — BRU The View non_schengen §36
 *   C8  PP fallback at any 3c lounge
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-22T10:00:00');

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'economy', departureAirport: 'MUC', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'DE', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: 'schengen', ...overrides,
  };
}
function makeStatus(tier: AllianceTier): StatusContext { return { allianceTier: tier, programCode: 'test', tierName: tier, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput {
  return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null, ...o };
}
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

const MUC_Europa       = (): LoungeInput => ({ id: 500, name: 'Europa Lounge', terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AY'], 600), exceptions: [] });
const MUC_World        = (): LoungeInput => ({ id: 501, name: 'Airport Lounge World', terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AA','BA','CX','WY','QR','RJ','AY'], 605), exceptions: [] });
const CDG_PrimeClass   = (): LoungeInput => ({ id: 502, name: 'PrimeClass Lounge', terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['BA','MH','AY'], 610), exceptions: [] });
const ZRH_AspireDockE  = (): LoungeInput => ({ id: 503, name: 'Aspire Lounge (Dock E)', terminalId: null, openingHours: null, area: 'non_schengen', channels: ryhma1(['BA','AY'], 615), exceptions: [] });
const VIE_SkyLounge    = (): LoungeInput => ({ id: 504, name: 'Sky Lounge', terminalId: null, openingHours: null, area: 'non_schengen', channels: ryhma1(['QR','AY'], 620), exceptions: [] });
const AMS_oneworld     = (): LoungeInput => ({ id: 505, name: 'oneworld Lounge (Lounge No.40)', terminalId: null, openingHours: null, area: 'non_schengen', channels: ryhma1(['AA','BA','CX','WY','QR','AT','RJ','AY'], 625), exceptions: [] });
const BRU_TheView      = (): LoungeInput => ({ id: 506, name: 'The View', terminalId: null, openingHours: null, area: 'non_schengen', channels: ryhma1(['BA','CX','QR','AY'], 630), exceptions: [] });

describe('Phase 32 (Batch 3c) — Central+Western Europe Ryhmä 1', () => {

  test('C1: AY Sapphire on AY MUC→HEL → Europa Lounge allowed (positive control)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), MUC_Europa(), { now: NOW }).status, 'allowed');
  });

  test('C2: AY Sapphire on AY MUC→HEL → Airport Lounge World allowed (§36 in [AA,BA,CX,WY,QR,RJ])', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), MUC_World(), { now: NOW }).status, 'allowed');
  });

  test('C3: BA Sapphire on BA CDG→LHR → PrimeClass Lounge allowed (non-AY oneworld path, MH+BA+AY list)', () => {
    const p = makePassenger({ operatingCarrier: 'BA', marketingCarrier: 'BA',
      departureAirport: 'CDG', departureCountryCode: 'FR', arrivalAirport: 'LHR', arrivalCountryCode: 'GB',
      arrivalIsSchengen: false, passengerZone: null });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), CDG_PrimeClass(), { now: NOW }).status, 'allowed');
  });

  test('C4: AY Sapphire on AY ZRH→JFK (non-Schengen departure) → Aspire Dock E allowed (zone match)', () => {
    // ZRH departing to JFK — passenger in non_schengen zone → Aspire Dock E (non_schengen) accessible.
    const p = makePassenger({ departureAirport: 'ZRH', departureCountryCode: 'CH',
      arrivalAirport: 'JFK', arrivalCountryCode: 'US', arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), ZRH_AspireDockE(), { now: NOW }).status, 'allowed');
  });

  test('C5: QR Sapphire on QR VIE→DOH → Sky Lounge allowed (QR native, no §36 dependency)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      departureAirport: 'VIE', departureCountryCode: 'AT', arrivalAirport: 'DOH', arrivalCountryCode: 'QA',
      arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), VIE_SkyLounge(), { now: NOW }).status, 'allowed');
  });

  test('C6: AY Sapphire on AY AMS→LHR (non-Schengen) → oneworld Lounge No.40 allowed (§36 + non_schengen zone)', () => {
    const p = makePassenger({ departureAirport: 'AMS', departureCountryCode: 'NL',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AMS_oneworld(), { now: NOW }).status, 'allowed');
  });

  test('C7: AY Sapphire on AY BRU→JFK (non-Schengen dep) → The View allowed (§36 + non_schengen zone)', () => {
    const p = makePassenger({ departureAirport: 'BRU', departureCountryCode: 'BE',
      arrivalAirport: 'JFK', arrivalCountryCode: 'US', arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), BRU_TheView(), { now: NOW }).status, 'allowed');
  });

  test('C8: PP-card on AY MUC→HEL → Europa Lounge allowed via PP (no status required)', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, MUC_Europa(), { now: NOW, passengerCards: cards }).status, 'allowed');
  });
});
