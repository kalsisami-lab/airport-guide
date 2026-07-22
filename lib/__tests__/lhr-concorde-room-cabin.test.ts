/**
 * LHR British Airways Concorde Room — cabin=first gate.
 *
 * Source: user field report (2026, LHR T5). oneworld Emerald holder on a
 * BA Business Class ticket was DENIED. Concorde Room policy is First-cabin
 * ticket only (BA/IB), status-independent.
 *
 * DB model post-patch (patch-lhr-concorde-room-cabin-fix.ts):
 *   channel_type       = airline_own
 *   carrier_restriction = ["BA","IB"]
 *   min_alliance_tier   = NULL
 *   conditions          = { equals: passenger.cabin === 'first' }
 *
 *   C1  BA First + no status                   → allowed (First-ticket path)
 *   C2  BA First + oneworld Emerald            → allowed
 *   C3  BA Business + oneworld Emerald         → NOT allowed (user's confirmed case)
 *   C4  BA Business + oneworld Sapphire        → NOT allowed
 *   C5  AY First (non-BA/IB carrier) at LHR    → NOT allowed (carrier gate)
 *   C6  IB First + no status                   → allowed (IB is on carrier list)
 *
 * C3 is the regression test that would have caught the previous
 * carrier_specific + oneworld_emerald model as too permissive.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-22T10:00:00');

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'BA',
    marketingCarrier:     'BA',
    operatingAlliance:    'oneworld',
    cabin:                'business',
    departureAirport:     'LHR',
    arrivalAirport:       'JFK',
    sameDayDeparture:     false,
    departureCountryCode: 'GB',
    arrivalCountryCode:   'US',
    arrivalIsSchengen:    false,
    passengerZone:        null,
    ...overrides,
  };
}

function makeStatus(tier: AllianceTier): StatusContext {
  return { allianceTier: tier, programCode: 'test', tierName: tier, fastTrack: false };
}

function makeConcordeRoom(): LoungeInput {
  const rule: RuleInput = {
    id: 14,
    priority: 100,
    validFrom: '2020-01-01',
    validTo: null,
    confidence: 0.99,
    minAllianceTier: null,
    carrierRestriction: ['BA', 'IB'],
    conditions: { op: 'equals', field: 'passenger.cabin', value: 'first' },
  };
  const channel: ChannelInput = {
    id: 14,
    channelType: 'airline_own',
    allianceAccess: null,
    rules: [rule],
  };
  return {
    id: 5, name: 'British Airways Concorde Room', terminalId: null, openingHours: null,
    area: 'international',
    channels: [channel],
    exceptions: [],
  };
}

describe('LHR British Airways Concorde Room — cabin=first gate', () => {

  test('C1: BA First + no status → allowed (First-ticket path, status irrelevant)', () => {
    const p = makePassenger({ cabin: 'first' });
    assert.equal(evaluateLoungeAccess(p, null, makeConcordeRoom(), { now: NOW }).status, 'allowed');
  });

  test('C2: BA First + oneworld Emerald → allowed (Emerald redundantly qualifies via First cabin)', () => {
    const p = makePassenger({ cabin: 'first' });
    const s = makeStatus('oneworld_emerald');
    assert.equal(evaluateLoungeAccess(p, s, makeConcordeRoom(), { now: NOW }).status, 'allowed');
  });

  test('C3: BA Business + oneworld Emerald → denied (user field report: Business cabin never qualifies, even with Emerald status)', () => {
    const p = makePassenger({ cabin: 'business' });
    const s = makeStatus('oneworld_emerald');
    const r = evaluateLoungeAccess(p, s, makeConcordeRoom(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
    assert.notEqual(r.status, 'likely_allowed');
  });

  test('C4: BA Business + oneworld Sapphire → denied (Sapphire never qualifies for Concorde Room even in First)', () => {
    const p = makePassenger({ cabin: 'business' });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeConcordeRoom(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('C5: AY First (Finnair, not BA/IB) at LHR → not allowed (carrier gate — Concorde Room is BA/IB only)', () => {
    const p = makePassenger({
      operatingCarrier: 'AY', marketingCarrier: 'AY',
      cabin: 'first',
      arrivalAirport: 'HEL', arrivalCountryCode: 'FI', arrivalIsSchengen: true,
    });
    const s = makeStatus('oneworld_emerald');
    const r = evaluateLoungeAccess(p, s, makeConcordeRoom(), { now: NOW });
    assert.notEqual(r.status, 'allowed');
  });

  test('C6: IB First + no status → allowed (IB is on the carrier list; First cabin gate satisfied)', () => {
    const p = makePassenger({
      operatingCarrier: 'IB', marketingCarrier: 'IB',
      cabin: 'first',
      arrivalAirport: 'MAD', arrivalCountryCode: 'ES', arrivalIsSchengen: true,
    });
    assert.equal(evaluateLoungeAccess(p, null, makeConcordeRoom(), { now: NOW }).status, 'allowed');
  });
});
