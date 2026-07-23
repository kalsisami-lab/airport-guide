/**
 * Phase 32 (Batch 2c): 16 airline-branded oneworld lounges (BA + QR + WY).
 *
 * Same all_alliance shape as Phase 30/31 — focus of the golden set:
 *   Q1  BA Sapphire at SIN BA Lounge (business/sapphire)
 *   Q2  QR Emerald at DOH Al Safwa First (first/emerald gate)
 *   Q3  QR Sapphire at DOH Al Safwa First → denied (tier gate: needs emerald)
 *   Q4  QR Ruby at DOH Silver Lounge → allowed (ruby meets ruby)
 *   Q5  QR Sapphire at DOH Silver Lounge → allowed (sapphire ≥ ruby)
 *   Q6  Alliance mismatch — LH at DOH Al Mourjan → not_applicable
 *   Q7  WY Sapphire at BKK Oman Air Lounge (new-carrier probe: WY seeded Phase 30)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T10:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'BA', marketingCarrier: 'BA', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'SIN', arrivalAirport: 'LHR',
    sameDayDeparture: false, departureCountryCode: 'SG', arrivalCountryCode: 'GB',
    arrivalIsSchengen: false, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput { return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null, ...o }; }
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput { return { id, channelType: t, allianceAccess: a, rules: r }; }
function ryhma2(minTier: AllianceTier, id: number): ChannelInput[] {
  return [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: minTier, carrierRestriction: null, confidence: 0.99, priority: 100 })], id)];
}

const SIN_BA_Lounge  = (): LoungeInput => ({ id: 900, name: 'British Airways Lounge',                terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_sapphire', 1000), exceptions: [] });
const DOH_AlSafwa    = (): LoungeInput => ({ id: 901, name: 'Al Safwa First Lounge',                 terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_emerald',  1010), exceptions: [] });
const DOH_Silver     = (): LoungeInput => ({ id: 902, name: 'Qatar Airways Silver Lounge - South',   terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_ruby',     1020), exceptions: [] });
const DOH_AlMourjan  = (): LoungeInput => ({ id: 903, name: 'Al Mourjan Business Lounge - The Garden', terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_sapphire', 1030), exceptions: [] });
const BKK_OmanAir    = (): LoungeInput => ({ id: 904, name: 'Oman Air First & Business Class Lounge', terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_sapphire', 1040), exceptions: [] });

describe('Phase 32 (Batch 2c) — BA + QR + WY Ryhmä 2', () => {

  test('Q1: BA Sapphire on BA SIN→LHR → BA Lounge allowed', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), SIN_BA_Lounge(), { now: NOW }).status, 'allowed');
  });

  test('Q2: QR Emerald on QR DOH→JFK → Al Safwa First allowed (emerald gate satisfied)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      departureAirport: 'DOH', departureCountryCode: 'QA', arrivalAirport: 'JFK', arrivalCountryCode: 'US' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), DOH_AlSafwa(), { now: NOW }).status, 'allowed');
  });

  test('Q3: QR Sapphire on QR DOH→JFK → Al Safwa First denied (needs emerald, sapphire insufficient)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      departureAirport: 'DOH', departureCountryCode: 'QA', arrivalAirport: 'JFK', arrivalCountryCode: 'US' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), DOH_AlSafwa(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('Q4: QR Ruby on QR DOH→BKK → Silver Lounge allowed (ruby meets ruby gate)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      departureAirport: 'DOH', departureCountryCode: 'QA', arrivalAirport: 'BKK', arrivalCountryCode: 'TH' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_ruby'), DOH_Silver(), { now: NOW }).status, 'allowed');
  });

  test('Q5: QR Sapphire on QR DOH→BKK → Silver Lounge allowed (sapphire ≥ ruby)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      departureAirport: 'DOH', departureCountryCode: 'QA', arrivalAirport: 'BKK', arrivalCountryCode: 'TH' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), DOH_Silver(), { now: NOW }).status, 'allowed');
  });

  test('Q6: oneworld Sapphire on LH DOH→FRA → Al Mourjan not_applicable (alliance_mismatch — Ryhmä 2)', () => {
    const p = makePassenger({ operatingCarrier: 'LH', marketingCarrier: 'LH', operatingAlliance: 'star_alliance',
      departureAirport: 'DOH', departureCountryCode: 'QA', arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), DOH_AlMourjan(), { now: NOW });
    assert.equal(r.status, 'not_applicable');
    assert.match(r.reason, /oneworld/i);
  });

  test('Q7: WY Sapphire on WY BKK→MCT → Oman Air Lounge allowed (WY new-carrier probe from Phase 30)', () => {
    const p = makePassenger({ operatingCarrier: 'WY', marketingCarrier: 'WY',
      departureAirport: 'BKK', departureCountryCode: 'TH', arrivalAirport: 'MCT', arrivalCountryCode: 'OM' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), BKK_OmanAir(), { now: NOW }).status, 'allowed');
  });
});
