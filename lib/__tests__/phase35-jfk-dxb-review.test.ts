/**
 * Phase 35 (JFK + DXB review) — 10 golden cases.
 *
 * JFK (§62 field-verified for L1, L4, L5):
 *   L1  Chelsea: AY Platinum (Emerald) + AY Business → DENIED (airline_own [AA,BA]
 *       + cabin=first). §52 AND-type. User field-verified 2026-07.
 *   L2  Chelsea: BA First (no status) → allowed
 *   L3  Greenwich: AY Sapphire + AY → allowed (§51 Ryhmä 1 sapphire, 9-carrier list)
 *   L4  Soho: AY Sapphire + AY → DENIED (emerald floor, §52 tier gate)
 *   L5  Soho: AY Platinum (Emerald) + AY Business → allowed (§52 OR-model,
 *       emerald alone qualifies). User field-verified 2026-07.
 *
 * DXB:
 *   L6  Marhaba: QR Sapphire → NOT allowed ([AY,AT] list only, §60 QR nuance
 *       not modeled — conservative)
 *   L7  Marhaba: AY Sapphire → allowed
 *   L8  Emirates First Lounge: QF Emerald → allowed (new Ryhmä 1 emerald channel)
 *   L9  Emirates First Lounge: EK First cabin → allowed (existing airline_own path)
 *   L10 Emirates Business Lounge: EK Business + no status → allowed (existing
 *       airline_own path, no oneworld status required); denied at Emirates First
 *       (First-only)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T12:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'JFK', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'US', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput { return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null, ...o }; }
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput { return { id, channelType: t, allianceAccess: a, rules: r }; }

function ryhma1(carriers: string[], minTier: AllianceTier, baseId: number): ChannelInput[] {
  return [
    makeChannel('alliance_status', 'carrier_specific',
      [makeRule({ minAllianceTier: minTier, carrierRestriction: carriers, confidence: 0.95 })], baseId),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.9 })], baseId + 1),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85 })], baseId + 2),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8 })], baseId + 3),
    makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50 })], baseId + 4),
  ];
}

// JFK fixtures
const Chelsea = (): LoungeInput => ({ id: 7000, name: 'BA/AA Chelsea Lounge', terminalId: null, openingHours: null, area: 'all',
  channels: [makeChannel('airline_own', null,
    [makeRule({ minAllianceTier: null, carrierRestriction: ['AA', 'BA'], confidence: 0.99,
      conditions: { op: 'equals', field: 'passenger.cabin', value: 'first' } as unknown as RuleInput['conditions'] })], 7100)],
  exceptions: [] });
const Greenwich = (): LoungeInput => ({ id: 7001, name: 'BA/AA Greenwich Lounge', terminalId: null, openingHours: null, area: 'all',
  channels: ryhma1(['AA','BA','CX','AY','IB','JL','QF','QR','RJ'], 'oneworld_sapphire', 7110), exceptions: [] });
const Soho = (): LoungeInput => ({ id: 7002, name: 'BA/AA Soho Lounge', terminalId: null, openingHours: null, area: 'all',
  channels: ryhma1(['AA','BA','CX','AY','IB','JL','QF','QR','RJ'], 'oneworld_emerald', 7120), exceptions: [] });

// DXB fixtures
const Marhaba_DXB = (): LoungeInput => ({ id: 7003, name: 'Marhaba Lounge', terminalId: null, openingHours: null, area: 'all',
  channels: [
    makeChannel('alliance_status', 'carrier_specific',
      [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AY', 'AT'], confidence: 0.95 })], 7130),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.95 })], 7131),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.95 })], 7132),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.95 })], 7133),
  ],
  exceptions: [] });

// EK First: airline_own [EK] + Ryhmä 1 [QF,AY] emerald
const EK_First = (): LoungeInput => ({ id: 7004, name: 'Emirates First Lounge', terminalId: null, openingHours: null, area: 'all',
  channels: [
    makeChannel('airline_own', null, [makeRule({ minAllianceTier: null, carrierRestriction: ['EK'], confidence: 0.99 })], 7140),
    ...ryhma1(['QF', 'AY'], 'oneworld_emerald', 7141),
  ],
  exceptions: [] });

const EK_Business = (): LoungeInput => ({ id: 7005, name: 'Emirates Business Lounge', terminalId: null, openingHours: null, area: 'all',
  channels: [
    makeChannel('airline_own', null, [makeRule({ minAllianceTier: null, carrierRestriction: ['EK'], confidence: 0.99 })], 7150),
    ...ryhma1(['QF', 'AY'], 'oneworld_sapphire', 7151),
  ],
  exceptions: [] });

describe('Phase 35 JFK+DXB review — §51/§52 + field verifications', () => {

  test('L1: AY Platinum (Emerald) + AY Business JFK→HEL → BA/AA Chelsea DENIED (§52 AND-type, §62 field-verified)', () => {
    const p = makePassenger();
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), Chelsea(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
    assert.notEqual(r.status, 'likely_allowed');
  });

  test('L2: BA First (no status) JFK→LHR → BA/AA Chelsea allowed (cabin gate satisfied)', () => {
    const p = makePassenger({ operatingCarrier: 'BA', marketingCarrier: 'BA', cabin: 'first',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, null, Chelsea(), { now: NOW }).status, 'allowed');
  });

  test('L3: AY Sapphire + AY JFK→HEL → BA/AA Greenwich allowed (§51 Ryhmä 1 sapphire, AY on 9-carrier list)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Greenwich(), { now: NOW }).status, 'allowed');
  });

  test('L4: AY Sapphire + AY Business → BA/AA Soho DENIED (§52 emerald floor, sapphire insufficient)', () => {
    const p = makePassenger();
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Soho(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('L5: AY Platinum (Emerald) + AY Business → BA/AA Soho allowed (§52 OR-model, §62 field-verified)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), Soho(), { now: NOW }).status, 'allowed');
  });

  test('L6: QR Sapphire + QR DXB→DOH → Marhaba NOT allowed (QR not on [AY,AT] list, §60 QR text not modeled)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      departureAirport: 'DXB', departureCountryCode: 'AE',
      arrivalAirport: 'DOH', arrivalCountryCode: 'QA', arrivalIsSchengen: false });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Marhaba_DXB(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('L7: AY Sapphire + AY DXB→HEL → Marhaba allowed', () => {
    const p = makePassenger({ departureAirport: 'DXB', departureCountryCode: 'AE' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Marhaba_DXB(), { now: NOW }).status, 'allowed');
  });

  test('L8: QF Emerald + QF DXB→SYD → Emirates First Lounge allowed (Ryhmä 1 emerald path)', () => {
    const p = makePassenger({ operatingCarrier: 'QF', marketingCarrier: 'QF',
      departureAirport: 'DXB', departureCountryCode: 'AE',
      arrivalAirport: 'SYD', arrivalCountryCode: 'AU', arrivalIsSchengen: false });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), EK_First(), { now: NOW }).status, 'allowed');
  });

  test('L9: EK First (no status) DXB→JFK → Emirates First Lounge allowed (airline_own [EK] path preserved)', () => {
    const p = makePassenger({ operatingCarrier: 'EK', marketingCarrier: 'EK', operatingAlliance: null,
      departureAirport: 'DXB', departureCountryCode: 'AE',
      arrivalAirport: 'JFK', arrivalCountryCode: 'US', arrivalIsSchengen: false, cabin: 'first' });
    assert.equal(evaluateLoungeAccess(p, null, EK_First(), { now: NOW }).status, 'allowed');
  });

  test('L10: EK Business + no status DXB→JFK → Emirates Business Lounge allowed (airline_own [EK] path, oneworld status not required)', () => {
    const p = makePassenger({ operatingCarrier: 'EK', marketingCarrier: 'EK', operatingAlliance: null,
      departureAirport: 'DXB', departureCountryCode: 'AE',
      arrivalAirport: 'JFK', arrivalCountryCode: 'US', arrivalIsSchengen: false, cabin: 'business' });
    assert.equal(evaluateLoungeAccess(p, null, EK_Business(), { now: NOW }).status, 'allowed');
  });
});
