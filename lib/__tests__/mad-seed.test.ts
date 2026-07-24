/**
 * MAD seed regression (§66 Case A closed).
 *
 *   M1  AY Sapphire on AY MAD→HEL (Schengen dep) → Dalí allowed (all_alliance)
 *   M2  AY Sapphire on AY MAD→JFK (non-Schengen dep) → Velázquez allowed (all_alliance)
 *   M3  AY Sapphire + MAD→HEL (Schengen dep) → Velázquez unreachable (non_schengen zone)
 *   M4  AY Sapphire + MAD→JFK (non-Schengen dep) → Dalí unreachable (schengen zone)
 *   M5  LH (Star) MAD → both lounges not_applicable (alliance mismatch, Ryhmä 2)
 *   M6  QR Sapphire on QR MAD→DOH → Velázquez allowed (QR is oneworld; all_alliance)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-24T12:00:00');

function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'MAD', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'ES', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: 'schengen', ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput {
  return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99,
    minAllianceTier: null, carrierRestriction: null, conditions: null, ...o };
}
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput {
  return { id, channelType: t, allianceAccess: a, rules: r };
}

const Dali      = (): LoungeInput => ({ id: 9000, name: 'Iberia Premium Lounge Dalí', terminalId: null, openingHours: null, area: 'schengen',
  channels: [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: null, confidence: 0.99, priority: 100 })], 9100)],
  exceptions: [] });

const Velazquez = (): LoungeInput => ({ id: 9001, name: 'Iberia Premium Lounge Velázquez', terminalId: null, openingHours: null, area: 'non_schengen',
  channels: [makeChannel('alliance_status', 'all_alliance',
    [makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: null, confidence: 0.99, priority: 100 })], 9110)],
  exceptions: [] });

describe('§66 Case A closed — MAD seed regression', () => {

  test('M1: AY Sapphire on AY MAD→HEL (Schengen dep) → Dalí allowed', () => {
    const p = makePassenger();
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Dali(), { now: NOW }).status, 'allowed');
  });

  test('M2: AY Sapphire on AY MAD→JFK (non-Schengen dep) → Velázquez allowed', () => {
    const p = makePassenger({ arrivalAirport: 'JFK', arrivalCountryCode: 'US',
      arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Velazquez(), { now: NOW }).status, 'allowed');
  });

  test('M3: AY Sapphire on AY MAD→HEL (Schengen dep) → Velázquez unreachable (non_schengen zone)', () => {
    const p = makePassenger();
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Velazquez(), { now: NOW });
    assert.equal(r.status, 'physically_unreachable');
  });

  test('M4: AY Sapphire on AY MAD→JFK (non-Schengen dep) → Dalí unreachable (schengen zone)', () => {
    const p = makePassenger({ arrivalAirport: 'JFK', arrivalCountryCode: 'US',
      arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Dali(), { now: NOW });
    assert.equal(r.status, 'physically_unreachable');
  });

  test('M5: LH (Star) MAD → Dalí not_applicable (Ryhmä 2 alliance mismatch)', () => {
    const p = makePassenger({ operatingCarrier: 'LH', marketingCarrier: 'LH', operatingAlliance: 'star_alliance',
      arrivalAirport: 'FRA', arrivalCountryCode: 'DE' });
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Dali(), { now: NOW });
    assert.equal(r.status, 'not_applicable');
    assert.match(r.reason, /oneworld/i);
  });

  test('M6: QR Sapphire on QR MAD→DOH (non-Schengen) → Velázquez allowed (all_alliance)', () => {
    const p = makePassenger({ operatingCarrier: 'QR', marketingCarrier: 'QR',
      arrivalAirport: 'DOH', arrivalCountryCode: 'QA', arrivalIsSchengen: false, passengerZone: 'non_schengen' });
    assert.equal(evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), Velazquez(), { now: NOW }).status, 'allowed');
  });
});
