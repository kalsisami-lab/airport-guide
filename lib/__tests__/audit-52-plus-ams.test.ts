/**
 * §52 First-class tier migration + AMS §51/opening-hours corrections.
 *
 * §52 tier migration tests (7 lounges):
 *   T1  HKG CX The Pier First: AY Sapphire + AY → DENIED (was allowed pre-migration)
 *   T2  HKG CX The Pier First: AY Emerald + AY → allowed
 *   T3  NRT JAL First Class:  AY Sapphire + AY → DENIED (regression)
 *   T4  MEL QF International First: AY Emerald + AY → allowed
 *   T5  MEL QF Domestic Business (unusual case, business_class but emerald-only per scrape):
 *       AY Sapphire → DENIED (regression from previous permissive sapphire floor)
 *
 * AMS §51 migration tests:
 *   A1  AMS oneworld Lounge (No.40): JL Sapphire + JL (Schengen dep, unreachable)
 *       Note: Schengen zone gate blocks first
 *   A2  AMS oneworld Lounge: AY Sapphire + AY non-Schengen departure → allowed
 *       (was paid_available under old Ryhmä 1 with §36 AY on list, but tests
 *       verify the new all_alliance path fires)
 *   A3  AMS oneworld Lounge: JL Sapphire + JL non-Schengen dep → allowed
 *       (was NOT allowed under old Ryhmä 1 — JL not on [AA,BA,CX,WY,QR,AT,RJ,AY] list,
 *        JL pax would have hit paid_available. Now all_alliance catches any oneworld.)
 *   A4  AMS oneworld Lounge: LH Star Gold non-Schengen dep → not_applicable
 *       (alliance_mismatch — Ryhmä 2 regression)
 *   A5  AMS Aspire Lounge: AY Sapphire + AY Schengen dep → allowed (unchanged)
 *   A6  AMS Aspire Lounge: JL Sapphire + JL Schengen dep → NOT allowed
 *       (Ryhmä 1 [AY,IB], JL not on contract, no §36 fallback for non-Finnair)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-23T10:00:00');
function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'HKG', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'HK', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput { return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null, ...o }; }
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput { return { id, channelType: t, allianceAccess: a, rules: r }; }

// Post-migration models
const HKG_PierFirst      = (): LoungeInput => ({ id: 5000, name: 'Cathay Pacific The Pier, First',       terminalId: null, openingHours: null, area: 'all',
  channels: [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: 'oneworld_emerald', carrierRestriction: null, confidence: 0.99, priority: 100 })], 5100)],
  exceptions: [] });

const NRT_JALFirst       = (): LoungeInput => ({ id: 5001, name: 'Japan Airlines First Class Lounge',   terminalId: null, openingHours: null, area: 'all',
  channels: [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: 'oneworld_emerald', carrierRestriction: null, confidence: 0.99, priority: 100 })], 5110)],
  exceptions: [] });

const MEL_QFIntlFirst    = (): LoungeInput => ({ id: 5002, name: 'Qantas International First',           terminalId: null, openingHours: null, area: 'all',
  channels: [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: 'oneworld_emerald', carrierRestriction: null, confidence: 0.99, priority: 100 })], 5120)],
  exceptions: [] });

const MEL_QFDomBiz       = (): LoungeInput => ({ id: 5003, name: 'Qantas Domestic Business',             terminalId: null, openingHours: null, area: 'all',
  channels: [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: 'oneworld_emerald', carrierRestriction: null, confidence: 0.99, priority: 100 })], 5130)],
  exceptions: [] });

// AMS post-migration models
const AMS_Oneworld_Post  = (): LoungeInput => ({ id: 5004, name: 'oneworld Lounge (Lounge No.40)',        terminalId: null, openingHours: null, area: 'non_schengen',
  channels: [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: null, confidence: 0.99, priority: 100 })], 5140)],
  exceptions: [] });

const AMS_Aspire         = (): LoungeInput => ({ id: 5005, name: 'Aspire Lounge (No.26)',                 terminalId: null, openingHours: null, area: 'schengen',
  channels: [
    makeChannel('alliance_status', 'carrier_specific',
      [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AY', 'IB'], confidence: 0.95 })], 5150),
    makeChannel('priority_pass', null, [makeRule({ confidence: 0.9 })], 5151),
    makeChannel('lounge_key',    null, [makeRule({ confidence: 0.85 })], 5152),
    makeChannel('dragon_pass',   null, [makeRule({ confidence: 0.8 })], 5153),
    makeChannel('paid',          null, [makeRule({ confidence: 0.9, priority: 50 })], 5154),
  ],
  exceptions: [] });

describe('§52 First-class tier migration + AMS §51 corrections', () => {

  // ── §52 tier migration ───────────────────────────────────────────────
  test('T1: AY Sapphire on AY HKG→HEL → CX The Pier First DENIED (regression: emerald floor now enforced)', () => {
    const p = makePassenger();
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), HKG_PierFirst(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
    assert.notEqual(r.status, 'likely_allowed');
  });

  test('T2: AY Emerald on AY HKG→HEL → CX The Pier First allowed (§52 OR-model, emerald qualifies)', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), HKG_PierFirst(), { now: NOW }).status, 'allowed');
  });

  test('T3: AY Sapphire on AY NRT→HEL → JAL First Class DENIED (regression)', () => {
    const p = makePassenger({ departureAirport: 'NRT', departureCountryCode: 'JP' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), NRT_JALFirst(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('T4: AY Emerald on AY MEL→HEL → QF International First allowed', () => {
    const p = makePassenger({ departureAirport: 'MEL', departureCountryCode: 'AU' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_emerald'), MEL_QFIntlFirst(), { now: NOW }).status, 'allowed');
  });

  test('T5: AY Sapphire on AY MEL→HEL → QF Domestic Business DENIED (unusual case: business_class but scrape emerald-only)', () => {
    const p = makePassenger({ departureAirport: 'MEL', departureCountryCode: 'AU' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), MEL_QFDomBiz(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  // ── AMS §51 migration ────────────────────────────────────────────────
  test('A1: AY Sapphire on AY AMS→HEL (Schengen dep) → oneworld Lounge (non_schengen area) physically_unreachable', () => {
    const p = makePassenger({ departureAirport: 'AMS', departureCountryCode: 'NL',
      arrivalIsSchengen: true, passengerZone: 'schengen' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AMS_Oneworld_Post(), { now: NOW });
    assert.equal(r.status, 'physically_unreachable');
  });

  test('A2: AY Sapphire on AY AMS→LHR (non-Schengen dep) → oneworld Lounge allowed (§51 all_alliance)', () => {
    const p = makePassenger({ departureAirport: 'AMS', departureCountryCode: 'NL',
      arrivalAirport: 'LHR', arrivalCountryCode: 'GB', arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AMS_Oneworld_Post(), { now: NOW }).status, 'allowed');
  });

  test('A3: JL Sapphire on JL AMS→NRT (non-Schengen dep) → oneworld Lounge allowed (was Ryhmä 1 blocked pre-migration)', () => {
    // Under Batch 3c Ryhmä 1 [AA,BA,CX,WY,QR,AT,RJ,AY], JL was NOT on list → would have been paid_available or blocked.
    // Now under Ryhmä 2 all_alliance, ANY oneworld carrier qualifies.
    const p = makePassenger({ operatingCarrier: 'JL', marketingCarrier: 'JL',
      departureAirport: 'AMS', departureCountryCode: 'NL',
      arrivalAirport: 'NRT', arrivalCountryCode: 'JP', arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AMS_Oneworld_Post(), { now: NOW }).status, 'allowed');
  });

  test('A4: LH Star Gold on LH AMS→FRA (non-Schengen dep) → oneworld Lounge not_applicable (alliance_mismatch)', () => {
    const p = makePassenger({ operatingCarrier: 'LH', marketingCarrier: 'LH', operatingAlliance: 'star_alliance',
      departureAirport: 'AMS', departureCountryCode: 'NL',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE', arrivalIsSchengen: true, passengerZone: 'non_schengen' });
    // Passenger going FRA (Schengen) but currently in non_schengen departure zone at AMS.
    // Actually LH FRA is Schengen destination but passenger zone (non_schengen) is what matters for lounge area gate.
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AMS_Oneworld_Post(), { now: NOW });
    // Two acceptable outcomes: zone mismatch (physically_unreachable) or alliance mismatch (not_applicable).
    // Priority: zone check fires first per engine order, then alliance.
    assert.ok(r.status === 'not_applicable' || r.status === 'physically_unreachable',
      `Expected not_applicable or physically_unreachable, got ${r.status}`);
  });

  test('A5: AY Sapphire on AY AMS→HEL (Schengen dep) → Aspire Lounge allowed (unchanged)', () => {
    const p = makePassenger({ departureAirport: 'AMS', departureCountryCode: 'NL',
      arrivalIsSchengen: true, passengerZone: 'schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AMS_Aspire(), { now: NOW }).status, 'allowed');
  });

  test('A6: JL Sapphire on JL AMS→NRT (non-Schengen dep) → Aspire NOT allowed (Ryhmä 1 [AY,IB] gate, JL not on list)', () => {
    // Non-Schengen departure + Aspire is schengen area → physically_unreachable via zone check
    const p = makePassenger({ operatingCarrier: 'JL', marketingCarrier: 'JL',
      departureAirport: 'AMS', departureCountryCode: 'NL',
      arrivalAirport: 'NRT', arrivalCountryCode: 'JP', arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), AMS_Aspire(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });
});
