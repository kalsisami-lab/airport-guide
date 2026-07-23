/**
 * Phase 32 (Batch 3f): 7 Ryhmä 1 lounges — MEL + odd/leisure airports.
 *
 *   F1  MEL Marhaba Business §36 (QR-only → AY added)
 *   F2  HKT Coral Executive positive control (AY on list)
 *   F3  HKT Coral First §36 (CX-only)
 *   F4  AYT CIP §36 with BA path (BA on list)
 *   F5  GOT Menzies Schengen zone gate
 *   F6  Walk-in at XIY First Class Lounge
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T10:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'economy', departureAirport: 'MEL', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'AU', arrivalCountryCode: 'FI',
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

const MEL_MarhabaBiz = (): LoungeInput => ({ id: 1400, name: 'Marhaba Business Lounge',            terminalId: null, openingHours: null, area: 'all',      channels: ryhma1(['QR', 'AY'],               1500), exceptions: [] });
const HKT_CoralExec  = (): LoungeInput => ({ id: 1401, name: 'The Coral Executive Lounge',         terminalId: null, openingHours: null, area: 'all',      channels: ryhma1(['CX', 'AY', 'MH', 'WY', 'QR'], 1505), exceptions: [] });
const HKT_CoralFirst = (): LoungeInput => ({ id: 1402, name: 'The Coral First Class Lounge',       terminalId: null, openingHours: null, area: 'all',      channels: ryhma1(['CX', 'AY'],               1510), exceptions: [] });
const AYT_CIP        = (): LoungeInput => ({ id: 1403, name: 'CIP Lounge',                         terminalId: null, openingHours: null, area: 'all',      channels: ryhma1(['BA', 'QR', 'AY'],         1515), exceptions: [] });
const GOT_Menzies    = (): LoungeInput => ({ id: 1404, name: 'The Lounge by Menzies Aviation',     terminalId: null, openingHours: null, area: 'schengen', channels: ryhma1(['BA', 'AY'],               1520), exceptions: [] });
const XIY_First      = (): LoungeInput => ({ id: 1405, name: 'First Class Lounge',                 terminalId: null, openingHours: null, area: 'all',      channels: ryhma1(['CX', 'AY'],               1525), exceptions: [] });

describe('Phase 32 (Batch 3f) — MEL + odd Ryhmä 1', () => {

  test('F1: AY Sapphire on AY MEL→HEL → Marhaba Business allowed (§36 — QR-only)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), MEL_MarhabaBiz(), { now: NOW }).status, 'allowed');
  });

  test('F2: AY Sapphire on AY HKT→HEL → Coral Executive allowed (positive control — AY in snapshot)', () => {
    const p = makePassenger({ departureAirport: 'HKT', departureCountryCode: 'TH' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), HKT_CoralExec(), { now: NOW }).status, 'allowed');
  });

  test('F3: AY Emerald on AY HKT→HEL → Coral First allowed (§36 CX-only → AY added; emerald qualifies via sapphire gate)', () => {
    const p = makePassenger({ departureAirport: 'HKT', departureCountryCode: 'TH' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), HKT_CoralFirst(), { now: NOW }).status, 'allowed');
  });

  test('F4: BA Sapphire on BA AYT→LHR → CIP allowed (BA on list, non-AY oneworld path)', () => {
    const p = makePassenger({ operatingCarrier: 'BA', marketingCarrier: 'BA',
      departureAirport: 'AYT', departureCountryCode: 'TR',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AYT_CIP(), { now: NOW }).status, 'allowed');
  });

  test('F5: AY Sapphire on AY GOT→HEL → Menzies allowed (Schengen zone match)', () => {
    const p = makePassenger({ departureAirport: 'GOT', departureCountryCode: 'SE',
      passengerZone: 'schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), GOT_Menzies(), { now: NOW }).status, 'allowed');
  });

  test('F6: walk-in (no status, no cards) on AY XIY→HEL → First Class Lounge paid_available', () => {
    const p = makePassenger({ departureAirport: 'XIY', departureCountryCode: 'CN' });
    assert.equal(evaluateLoungeAccess(p, null, XIY_First(), { now: NOW }).status, 'paid_available');
  });
});
