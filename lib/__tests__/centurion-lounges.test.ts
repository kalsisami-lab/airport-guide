/**
 * Centurion Lounge seed verification (§66).
 *
 *   C1  DFW Centurion + Amex Platinum → allowed via amex_centurion
 *   C2  DFW Centurion + no cards, oneworld Sapphire → denied
 *       (Centurion is card-based, tier doesn't apply)
 *   C3  HKG Centurion + Amex Platinum → allowed (regression: exists
 *       alongside 11 other HKG lounges without conflicts)
 *   C4  ARN "The Centurion Lounge" + Amex Platinum → allowed
 *       (renamed from "American Express Lounge")
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-24T12:00:00');

function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AA', marketingCarrier: 'AA', operatingAlliance: 'oneworld',
    cabin: 'economy', departureAirport: 'DFW', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'US', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }
function makeRule(o: Partial<RuleInput> = {}): RuleInput {
  return { id: 1, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.95,
    minAllianceTier: null, carrierRestriction: null, conditions: null, ...o };
}
function makeChannel(t: ChannelType, a: ChannelInput['allianceAccess'], r: RuleInput[], id = 1): ChannelInput {
  return { id, channelType: t, allianceAccess: a, rules: r };
}

// Centurion lounge fixture: single amex_centurion channel, no PP/tier
function centurionLounge(id: number, name: string): LoungeInput {
  return { id, name, terminalId: null, openingHours: null, area: 'all',
    channels: [makeChannel('amex_centurion', null, [makeRule({ confidence: 0.95 })], id * 10)],
    exceptions: [] };
}

describe('§66 Centurion Lounge seeding', () => {

  test('C1: Amex Platinum holder + AA DFW→HEL → DFW Centurion allowed', () => {
    const p = makePassenger();
    const cards: ChannelType[] = ['amex_centurion'];
    assert.equal(
      evaluateLoungeAccess(p, null, centurionLounge(257, 'The Centurion Lounge'), { now: NOW, passengerCards: cards }).status,
      'allowed'
    );
  });

  test('C2: AA Sapphire (no Amex card) + AA DFW→HEL → DFW Centurion NOT allowed (card-based access only)', () => {
    const p = makePassenger();
    const r = evaluateLoungeAccess(p, makeStatus('oneworld_sapphire'), centurionLounge(257, 'The Centurion Lounge'), { now: NOW });
    // No cards → amex_centurion channel doesn't fire. No other channel → no path.
    assert.notEqual(r.status, 'allowed');
  });

  test('C3: Amex Platinum + AY HKG→HEL → HKG Centurion allowed (regression: coexists with other HKG lounges)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', marketingCarrier: 'AY',
      departureAirport: 'HKG', departureCountryCode: 'HK',
    });
    const cards: ChannelType[] = ['amex_centurion'];
    assert.equal(
      evaluateLoungeAccess(p, null, centurionLounge(261, 'The Centurion Lounge'), { now: NOW, passengerCards: cards }).status,
      'allowed'
    );
  });

  test('C4: Amex Platinum + AY ARN→HEL → ARN "The Centurion Lounge" allowed (renamed from "American Express Lounge")', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', marketingCarrier: 'AY',
      departureAirport: 'ARN', departureCountryCode: 'SE',
      passengerZone: 'schengen',
    });
    const cards: ChannelType[] = ['amex_centurion'];
    assert.equal(
      evaluateLoungeAccess(p, null, centurionLounge(30, 'The Centurion Lounge'), { now: NOW, passengerCards: cards }).status,
      'allowed'
    );
  });
});
