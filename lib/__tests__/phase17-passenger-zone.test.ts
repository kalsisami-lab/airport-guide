/**
 * Phase 17: passengerZone fallback for Schengen routing.
 *
 * Precedence rule (see lib/engine/evaluateLoungeAccess.ts):
 *   1. arrivalIsSchengen (derived from arrival IATA country lookup) — ground truth
 *   2. passengerZone (UI hint) — used only when arrivalIsSchengen is null
 *
 * Core fix: when the user picks "Schengen" in the UI but does not select a specific
 * destination airport, arrivalIsSchengen falls through to null. Before Phase 17,
 * this bypassed the zone check → non-Schengen lounges (e.g. Plaza Premium HEL id=27,
 * Finnair Platinum Wing id=1) appeared reachable on Schengen flights.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext } from '../normalization/types';
import type { ChannelType, LoungeInput } from '../engine/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'HEL',
    arrivalAirport:       'UNKN',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    arrivalIsSchengen:    null,
    passengerZone:        null,
    ...overrides,
  };
}

function makeStatus(): StatusContext {
  return { allianceTier: 'none', programCode: '', tierName: '', fastTrack: false };
}

function makeLounge(area: LoungeInput['area']): LoungeInput {
  return {
    id:           1,
    name:         'Test Lounge',
    terminalId:   null,
    openingHours: null,
    area,
    channels: [{
      id: 1, channelType: 'priority_pass', allianceAccess: null,
      rules: [{
        id: 1, priority: 100, validFrom: '2020-01-01', validTo: null,
        confidence: 0.9, minAllianceTier: null, carrierRestriction: null, conditions: null,
      }],
    }],
    exceptions: [],
  };
}

// evaluateLoungeAccess's paid fallback triggers when no channel matches; passing
// priority_pass card ensures the PP channel matches so we can distinguish "zone
// blocked" from "no matching rule".
const cards: ChannelType[] = ['priority_pass'];
const status = makeStatus();

// ─── passengerZone fallback (arrival unknown) ────────────────────────────────

describe('Phase 17 — passengerZone fallback when arrival unknown', () => {

  test('arrivalIsSchengen=null + passengerZone=schengen + non_schengen lounge → physically_unreachable', () => {
    const p = makePassenger({ arrivalIsSchengen: null, passengerZone: 'schengen' });
    const r = evaluateLoungeAccess(p, status, makeLounge('non_schengen'), { passengerCards: cards });
    assert.equal(r.status, 'physically_unreachable');
    assert.equal(r.source, 'schengen_zone_check');
    assert.match(r.reason, /area you selected/);
  });

  test('arrivalIsSchengen=null + passengerZone=non_schengen + schengen lounge → physically_unreachable', () => {
    const p = makePassenger({ arrivalIsSchengen: null, passengerZone: 'non_schengen' });
    const r = evaluateLoungeAccess(p, status, makeLounge('schengen'), { passengerCards: cards });
    assert.equal(r.status, 'physically_unreachable');
    assert.match(r.reason, /area you selected/);
  });

  test('arrivalIsSchengen=null + passengerZone=schengen + schengen lounge → not blocked (matches)', () => {
    const p = makePassenger({ arrivalIsSchengen: null, passengerZone: 'schengen' });
    const r = evaluateLoungeAccess(p, status, makeLounge('schengen'), { passengerCards: cards });
    assert.notEqual(r.status, 'physically_unreachable');
    assert.equal(r.status, 'allowed');
  });
});

// ─── Regression: no zone info at all still works as before ───────────────────

describe('Phase 17 — no zone info (regression)', () => {

  test('arrivalIsSchengen=null + passengerZone=null + non_schengen lounge → no zone block', () => {
    const p = makePassenger({ arrivalIsSchengen: null, passengerZone: null });
    const r = evaluateLoungeAccess(p, status, makeLounge('non_schengen'), { passengerCards: cards });
    assert.notEqual(r.status, 'physically_unreachable');
  });
});

// ─── Precedence: arrival wins over passengerZone ─────────────────────────────

describe('Phase 17 — arrival wins over passengerZone', () => {

  test('arrivalIsSchengen=true + passengerZone=non_schengen (conflict) + non_schengen lounge → physically_unreachable', () => {
    // Arrival says Schengen destination, UI hint disagrees. Arrival wins:
    // non_schengen lounge is unreachable on a Schengen flight.
    const p = makePassenger({ arrivalIsSchengen: true, passengerZone: 'non_schengen' });
    const r = evaluateLoungeAccess(p, status, makeLounge('non_schengen'), { passengerCards: cards });
    assert.equal(r.status, 'physically_unreachable');
    // Reason must reference the flight (not the UI hint) — precedence dictates source
    assert.match(r.reason, /flight/);
  });

  test('arrivalIsSchengen=false + passengerZone=schengen (conflict) + schengen lounge → physically_unreachable', () => {
    const p = makePassenger({ arrivalIsSchengen: false, passengerZone: 'schengen' });
    const r = evaluateLoungeAccess(p, status, makeLounge('schengen'), { passengerCards: cards });
    assert.equal(r.status, 'physically_unreachable');
    assert.match(r.reason, /flight/);
  });

  test('arrivalIsSchengen=true + passengerZone=null + schengen lounge → not blocked (arrival matches)', () => {
    const p = makePassenger({ arrivalIsSchengen: true, passengerZone: null });
    const r = evaluateLoungeAccess(p, status, makeLounge('schengen'), { passengerCards: cards });
    assert.equal(r.status, 'allowed');
  });

  test('arrivalIsSchengen=false + passengerZone=null + non_schengen lounge → not blocked (arrival matches)', () => {
    const p = makePassenger({ arrivalIsSchengen: false, passengerZone: null });
    const r = evaluateLoungeAccess(p, status, makeLounge('non_schengen'), { passengerCards: cards });
    assert.equal(r.status, 'allowed');
  });
});

// ─── area='all' is never zone-blocked ────────────────────────────────────────

describe('Phase 17 — passengerZone with area=all is never blocked', () => {

  test('passengerZone=schengen + area=all → no zone block', () => {
    const p = makePassenger({ arrivalIsSchengen: null, passengerZone: 'schengen' });
    const r = evaluateLoungeAccess(p, status, makeLounge('all'), { passengerCards: cards });
    assert.notEqual(r.status, 'physically_unreachable');
  });
});
