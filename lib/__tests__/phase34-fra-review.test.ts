/**
 * Phase 34 (FRA review): 3 new oneworld lounges + Primeclass update + demo deletions.
 *
 *   F1  Air France/KLM (Ryhmä 3) — AY Sapphire → NOT allowed (Ryhmä 3 [IB] contract,
 *       no §36 fallback; AY not on list)
 *   F2  Air France/KLM — IB Sapphire → allowed (IB on contract list)
 *   F3  Priority Lounge (T2) [QR,AY] — AY Sapphire (§36) → allowed
 *   F4  Priority Lounge (T3) [AA,BA,CX,JL,AY] — JL Sapphire → allowed (JL on list)
 *   F5  Priority Lounge (T2, non_schengen) — Schengen-departing pax →
 *       physically_unreachable
 *   F6  Primeclass Lounge (schengen) — AT Sapphire on AT Schengen dep → allowed
 *       (§36 [AT,AY])
 *   F7  Primeclass Lounge — walk-in (24h) → paid_available
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T12:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'FRA', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'DE', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: 'non_schengen', ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput { return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null, ...o }; }
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput { return { id, channelType: t, allianceAccess: a, rules: r }; }

// Ryhmä 3 single channel (no PP/paid)
function ryhma3(carriers: string[], id: number): ChannelInput[] {
  return [makeChannel('alliance_status', 'carrier_specific',
    [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, confidence: 0.95 })], id)];
}

// Ryhmä 1 5-channel with cabin condition optional
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

// Fixtures
const AF_KLM      = (): LoungeInput => ({ id: 6000, name: 'Air France/KLM Lounge',   terminalId: null, openingHours: null, area: 'non_schengen', channels: ryhma3(['IB'], 6100), exceptions: [] });
const Priority_T2 = (): LoungeInput => ({ id: 6001, name: 'Priority Lounge (T2)',    terminalId: null, openingHours: null, area: 'non_schengen', channels: ryhma1(['QR','AY'], 6110), exceptions: [] });
const Priority_T3 = (): LoungeInput => ({ id: 6002, name: 'Priority Lounge (T3)',    terminalId: null, openingHours: null, area: 'non_schengen', channels: ryhma1(['AA','BA','CX','JL','AY'], 6120), exceptions: [] });
const Primeclass  = (): LoungeInput => ({ id: 6003, name: 'Primeclass Lounge',       terminalId: null, openingHours: null, area: 'schengen',
  channels: [
    makeChannel('alliance_status', 'carrier_specific',
      [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AT','AY'], confidence: 0.95 })], 6130),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.9 })], 6131),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85 })], 6132),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8 })], 6133),
    makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50 })], 6134),
  ],
  exceptions: [] });

describe('Phase 34 FRA review', () => {

  test('F1: AY Sapphire on AY FRA→HEL → Air France/KLM Lounge NOT allowed (Ryhmä 3, AY not on [IB] contract)', () => {
    const p = makePassenger();
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AF_KLM(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('F2: IB Sapphire on IB FRA→LHR (non-Schengen dep) → Air France/KLM Lounge allowed (IB on contract, zone matches)', () => {
    const p = makePassenger({ operatingCarrier: 'IB', marketingCarrier: 'IB',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false,
      passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AF_KLM(), { now: NOW }).status, 'allowed');
  });

  test('F3: AY Sapphire on AY FRA→JFK (non-Schengen dep) → Priority Lounge (T2) allowed (§36 QR-only + AY, zone matches)', () => {
    const p = makePassenger({ arrivalAirport: 'JFK', arrivalCountryCode: 'US',
      arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Priority_T2(), { now: NOW }).status, 'allowed');
  });

  test('F4: JL Sapphire on JL FRA→NRT → Priority Lounge (T3) allowed (JL on [AA,BA,CX,JL,AY])', () => {
    const p = makePassenger({ operatingCarrier: 'JL', marketingCarrier: 'JL',
      arrivalAirport: 'NRT', arrivalCountryCode: 'JP', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Priority_T3(), { now: NOW }).status, 'allowed');
  });

  test('F5: AY Sapphire on AY FRA→ARN (Schengen dep) → Priority Lounge (T2, non_schengen) physically_unreachable', () => {
    const p = makePassenger({ arrivalAirport: 'ARN', arrivalCountryCode: 'SE',
      arrivalIsSchengen: true, passengerZone: 'schengen' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Priority_T2(), { now: NOW });
    assert.equal(r.status, 'physically_unreachable');
  });

  test('F6: AT Sapphire on AT FRA→MAD (Schengen dep) → Primeclass Lounge allowed (§36 [AT,AY], zone matches)', () => {
    // Note: engine doesn't verify carrier-route reality; using MAD (Schengen) so
    // the Schengen departure zone matches Primeclass (schengen area).
    const p = makePassenger({ operatingCarrier: 'AT', marketingCarrier: 'AT',
      arrivalAirport: 'MAD', arrivalCountryCode: 'ES', arrivalIsSchengen: true,
      passengerZone: 'schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Primeclass(), { now: NOW }).status, 'allowed');
  });

  test('F7: walk-in (no status, no cards) at Primeclass Lounge (24h) → paid_available', () => {
    const p = makePassenger({ passengerZone: 'schengen' });
    assert.equal(evaluateLoungeAccess(p, null, Primeclass(), { now: NOW }).status, 'paid_available');
  });
});
