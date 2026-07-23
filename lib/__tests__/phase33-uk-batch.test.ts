/**
 * Phase 33 (UK Batch): LHR + MAN + EDI. Golden set focuses on §51/§52
 * distinctions:
 *
 *   L1  LHR AA International First (all_alliance/emerald) — AY Platinum
 *       (Emerald) on Business ticket → allowed (§52 OR-model)
 *   L2  LHR Cathay Pacific First Class Lounge — Emerald + Business →
 *       allowed (user field-verified path)
 *   L3  LHR BA Concorde Room — Emerald + Business → DENIED (Phase #6
 *       cabin=first model, §52 AND-type — regression from Phase 33)
 *   L4  LHR Cathay Pacific Business Class Lounge (all_alliance/sapphire)
 *       — Sapphire + Economy → allowed
 *   L5  LHR Qatar Airways Premium Lounge (Ryhmä 1 + cabin gate) —
 *       Sapphire + Business → allowed (§36 [MH,QR,AT,AY] + cabin in list)
 *   L6  LHR Qatar Airways Premium Lounge — Sapphire + Economy → NOT
 *       allowed (cabin gate blocks)
 *   L7  MAN 1903 Lounge (§36) — AY Sapphire → allowed
 *   L8  MAN The Executive by Escape Lounges (§36 CX-only → +AY) —
 *       AY Sapphire → allowed
 *   L9  EDI Aspire Lounge (Ryhmä 1 [IB,AY]) — BA Sapphire → NOT allowed
 *       (BA not on contract list)
 *   L10 EDI Turkish Airlines Lounge — AY Sapphire → allowed
 *   L11 LHR BA Galleries North Club (Ryhmä 2 sapphire) — QR Sapphire →
 *       allowed (all_alliance)
 *   L12 Walk-in at LHR Plaza Premium T4 → paid_available
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T10:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'BA', marketingCarrier: 'BA', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'LHR', arrivalAirport: 'JFK',
    sameDayDeparture: false, departureCountryCode: 'GB', arrivalCountryCode: 'US',
    arrivalIsSchengen: false, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput { return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null, ...o }; }
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput { return { id, channelType: t, allianceAccess: a, rules: r }; }

// Ryhmä 2 all_alliance channel factory
function ryhma2(minTier: AllianceTier, id: number): ChannelInput[] {
  return [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: minTier, carrierRestriction: null, confidence: 0.99, priority: 100 })], id)];
}

// Ryhmä 1 5-channel factory with optional cabin condition
function ryhma1(carriers: string[], baseId: number, cabinCond: object | null = null): ChannelInput[] {
  return [
    makeChannel('alliance_status', 'carrier_specific',
      [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, confidence: 0.95, conditions: cabinCond as RuleInput['conditions'] })], baseId),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.9 })], baseId + 1),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85 })], baseId + 2),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8 })],  baseId + 3),
    makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50 })], baseId + 4),
  ];
}

// airline_own factory (BA Concorde Room)
function airlineOwnCabin(carriers: string[], baseId: number): ChannelInput[] {
  return [makeChannel('airline_own', null,
    [makeRule({ minAllianceTier: null, carrierRestriction: carriers, confidence: 0.99,
      conditions: { op: 'equals', field: 'passenger.cabin', value: 'first' } as unknown as RuleInput['conditions'] })], baseId)];
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const AA_IntlFirst = (): LoungeInput => ({ id: 2000, name: 'American Airlines International First Class Lounge', terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_emerald', 2100), exceptions: [] });
const CX_First     = (): LoungeInput => ({ id: 2001, name: 'Cathay Pacific First Class Lounge',                   terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_emerald', 2110), exceptions: [] });
const CX_Biz       = (): LoungeInput => ({ id: 2002, name: 'Cathay Pacific Business Class Lounge',                terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_sapphire', 2120), exceptions: [] });
const BA_NorthClub = (): LoungeInput => ({ id: 2003, name: 'BA Galleries North Club',                             terminalId: null, openingHours: null, area: 'all', channels: ryhma2('oneworld_sapphire', 2130), exceptions: [] });
const BA_Concorde  = (): LoungeInput => ({ id: 2004, name: 'British Airways Concorde Room',                       terminalId: null, openingHours: null, area: 'all', channels: airlineOwnCabin(['BA', 'IB'], 2140), exceptions: [] });

const QR_Premium   = (): LoungeInput => ({ id: 2005, name: 'Qatar Airways Premium Lounge', terminalId: null, openingHours: null, area: 'all',
  channels: ryhma1(['MH', 'QR', 'AT', 'AY'], 2150,
    { op: 'in', field: 'passenger.cabin', values: ['first', 'business'] }), exceptions: [] });
const LHR_Plaza    = (): LoungeInput => ({ id: 2006, name: 'Plaza Premium Lounge', terminalId: null, openingHours: null, area: 'all',
  channels: ryhma1(['AT', 'AY'], 2160), exceptions: [] });

const MAN_1903     = (): LoungeInput => ({ id: 2007, name: '1903 Lounge',                     terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['QR', 'AY'],       2170), exceptions: [] });
const MAN_Exec     = (): LoungeInput => ({ id: 2008, name: 'The Executive by Escape Lounges', terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['CX', 'AY'],       2180), exceptions: [] });

const EDI_Aspire   = (): LoungeInput => ({ id: 2009, name: 'Aspire Lounge',                   terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['IB', 'AY'],       2190), exceptions: [] });
const EDI_TK       = (): LoungeInput => ({ id: 2010, name: 'Turkish Airlines Lounge',         terminalId: null, openingHours: null, area: 'all', channels: ryhma1(['AY', 'QR'],       2200), exceptions: [] });

// ─── L1–L12 ────────────────────────────────────────────────────────────────

describe('Phase 33 UK batch — §51/§52 wording-based classification', () => {

  test('L1: AY Platinum (Emerald) + BA Business ticket LHR → AA International First allowed (§52 OR-model — emerald alone qualifies)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', marketingCarrier: 'AY',
      departureAirport: 'LHR', arrivalAirport: 'HEL', arrivalCountryCode: 'FI', arrivalIsSchengen: true });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), AA_IntlFirst(), { now: NOW }).status, 'allowed');
  });

  test('L2: AY Platinum (Emerald) + BA Business LHR → CX First Class Lounge allowed (§52 OR — user field-verified)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', marketingCarrier: 'AY',
      departureAirport: 'LHR', arrivalAirport: 'HEL', arrivalCountryCode: 'FI', arrivalIsSchengen: true });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), CX_First(), { now: NOW }).status, 'allowed');
  });

  test('L3: AY Platinum (Emerald) + BA Business LHR → BA Concorde Room DENIED (Phase #6 cabin=first, §52 AND-type)', () => {
    const p = makePassenger({ operatingCarrier: 'BA', cabin: 'business' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), BA_Concorde(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
    assert.notEqual(r.status, 'likely_allowed');
  });

  test('L4: BA Sapphire + BA Economy LHR → CX Business Class Lounge allowed (Ryhmä 2 sapphire)', () => {
    const p = makePassenger({ cabin: 'economy' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), CX_Biz(), { now: NOW }).status, 'allowed');
  });

  test('L5: QR Sapphire + QR Business LHR → Qatar Airways Premium Lounge allowed (§36 + cabin in [first,business])', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR', cabin: 'business' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), QR_Premium(), { now: NOW }).status, 'allowed');
  });

  test('L6: QR Sapphire + QR Economy LHR → Qatar Airways Premium Lounge NOT allowed (cabin gate)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR', cabin: 'economy' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), QR_Premium(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('L7: AY Sapphire + AY MAN→HEL → 1903 Lounge allowed (§36 [QR]→+AY)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', marketingCarrier: 'AY',
      departureAirport: 'MAN', arrivalAirport: 'HEL', arrivalCountryCode: 'FI', arrivalIsSchengen: true, cabin: 'economy' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), MAN_1903(), { now: NOW }).status, 'allowed');
  });

  test('L8: AY Sapphire + AY MAN→HEL → Executive by Escape Lounges allowed (§36 [CX]→+AY)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', marketingCarrier: 'AY',
      departureAirport: 'MAN', arrivalAirport: 'HEL', arrivalCountryCode: 'FI', arrivalIsSchengen: true, cabin: 'economy' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), MAN_Exec(), { now: NOW }).status, 'allowed');
  });

  test('L9: BA Sapphire + BA EDI→LHR → EDI Aspire NOT allowed (BA not on [IB,AY] contract, no §36 fallback for BA)', () => {
    const p = makePassenger({ departureAirport: 'EDI', arrivalAirport: 'LHR', cabin: 'economy' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), EDI_Aspire(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('L10: AY Sapphire + AY EDI→HEL → EDI Turkish Airlines Lounge allowed', () => {
    const p = makePassenger({ operatingCarrier: 'AY', marketingCarrier: 'AY',
      departureAirport: 'EDI', arrivalAirport: 'HEL', arrivalCountryCode: 'FI', arrivalIsSchengen: true, cabin: 'economy' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), EDI_TK(), { now: NOW }).status, 'allowed');
  });

  test('L11: QR Sapphire + QR LHR→DOH → BA Galleries North Club allowed (Ryhmä 2 all_alliance — any oneworld qualifies)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      arrivalAirport: 'DOH', arrivalCountryCode: 'QA', cabin: 'business' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), BA_NorthClub(), { now: NOW }).status, 'allowed');
  });

  test('L12: walk-in (no status, no cards) + AY LHR→HEL → Plaza Premium T4 paid_available', () => {
    const p = makePassenger({ operatingCarrier: 'AY', marketingCarrier: 'AY',
      arrivalAirport: 'HEL', arrivalCountryCode: 'FI', arrivalIsSchengen: true, cabin: 'economy' });
    assert.equal(evaluateLoungeAccess(p, null, LHR_Plaza(), { now: NOW }).status, 'paid_available');
  });
});
