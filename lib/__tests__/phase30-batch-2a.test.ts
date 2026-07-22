/**
 * Phase 30 (Batch 2a): AA + Alaska airline-branded oneworld lounges.
 *
 * First all_alliance-shaped batch test. Covers the model's four
 * behavioural branches:
 *   K1  positive same-alliance                  → allowed
 *   K2  positive same-alliance different member → allowed
 *   K3  negative alliance mismatch               → not_applicable
 *   K4  operating alliance unknown               → likely_allowed conf 0.6
 *   K5  tier below Sapphire                      → denied
 *   K6  tier above Sapphire (Emerald)            → allowed
 *   K7  card-only, no status                     → denied
 *
 * K3 is the critical one: a Star Alliance passenger arriving at a
 * oneworld-only lounge must NOT slip through the walk-in / fallback
 * path. The engine returns `not_applicable` with the reason
 * "This is a oneworld lounge; your flight is on a different alliance
 * carrier" — verified against evaluateLoungeAccess.ts:348.
 *
 * K4 tests the useful behaviour when the passenger has status but the
 * flight isn't set yet — engine returns `likely_allowed` conf 0.6.
 * This drives the UI hint "Access likely if departing on a oneworld
 * flight — add your flight to confirm".
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { ChannelInput, ChannelType, LoungeInput, RuleInput } from '../engine/types';

const NOW = new Date('2026-07-22T10:00:00');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AA',
    marketingCarrier:     'AA',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'ORD',
    arrivalAirport:       'JFK',
    sameDayDeparture:     false,
    departureCountryCode: 'US',
    arrivalCountryCode:   'US',
    arrivalIsSchengen:    false,
    passengerZone:        null,
    ...overrides,
  };
}

function makeStatus(tier: AllianceTier): StatusContext {
  return { allianceTier: tier, programCode: 'test', tierName: tier, fastTrack: false };
}

function makeRule(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    id: 1, priority: 100, validFrom: '2020-01-01', validTo: null,
    confidence: 0.99, minAllianceTier: null, carrierRestriction: null, conditions: null,
    ...overrides,
  };
}

function makeChannel(
  channelType: ChannelType,
  allianceAccess: ChannelInput['allianceAccess'],
  rules: RuleInput[],
  id = 1,
): ChannelInput {
  return { id, channelType, allianceAccess, rules };
}

// Ryhmä 2 fixture: one alliance_status / all_alliance channel, sapphire+, conf 0.99.
// No PP/paid/other channels.
function makeAllAllianceOneworldLounge(id: number, name: string): LoungeInput {
  return {
    id, name, terminalId: null, openingHours: null,
    area: 'all',
    channels: [
      makeChannel('alliance_status', 'all_alliance', [
        makeRule({ minAllianceTier: 'oneworld_sapphire', carrierRestriction: null, confidence: 0.99, priority: 100 }),
      ], id * 10),
    ],
    exceptions: [],
  };
}

// Test fixtures for a few representative lounges
function makeORDAdmirals()  { return makeAllAllianceOneworldLounge(79, 'American Airlines Admirals Club'); }
function makeORDFlagship()  { return makeAllAllianceOneworldLounge(80, 'American Airlines Flagship Lounge'); }
function makeLAXAdmirals()  { return makeAllAllianceOneworldLounge(88, 'American Airlines Admirals Club'); }
function makeLAXAlaska()    { return makeAllAllianceOneworldLounge(87, 'Alaska Lounge'); }
function makeSEAAlaska()    { return makeAllAllianceOneworldLounge(93, 'Alaska Lounge'); }

// ─── K1–K7: Ryhmä 2 (all_alliance oneworld) tests ───────────────────────────

describe('Phase 30 — AA + Alaska airline-branded oneworld lounges (all_alliance model)', () => {

  test('K1: AY Gold (oneworld_sapphire) + AY LAX→JFK → AA Admirals LAX allowed via oneworld status (positive, same-alliance)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld', departureAirport: 'LAX' });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeLAXAdmirals(), { now: NOW });
    assert.equal(r.status, 'allowed');
    assert.match(r.reason, /oneworld_sapphire/);
  });

  test('K2: BA Gold (Sapphire) + BA LHR→ORD → AA Admirals ORD allowed (BA on oneworld flight, same-alliance different member)', () => {
    const p = makePassenger({ operatingCarrier: 'BA', operatingAlliance: 'oneworld', departureAirport: 'LHR', arrivalAirport: 'ORD', departureCountryCode: 'GB' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeORDAdmirals(), { now: NOW }).status, 'allowed');
  });

  test('K3: AY Gold (oneworld_sapphire) BOOKED on LH FRA→ORD (star_alliance carrier) → AA Admirals ORD not_applicable ("this is a oneworld lounge; your flight is on a different alliance carrier")', () => {
    // Critical negative case: alliance_mismatch fires only when the
    // passenger holds a matching-alliance tier BUT the operating carrier
    // is a different alliance. A oneworld Sapphire status holder booked
    // on an LH award ticket loses lounge access at oneworld lounges —
    // the tier is right but the flight is wrong.
    //
    // A pure Star Gold + Star-flight scenario (no oneworld tier at all)
    // correctly returns `denied` because the passenger doesn't qualify
    // for any oneworld path — that's a different assertion (would fit K5
    // shape) and is left out; K3 focuses on the mismatch reason string.
    const p = makePassenger({ operatingCarrier: 'LH', operatingAlliance: 'star_alliance', departureAirport: 'FRA', arrivalAirport: 'ORD', departureCountryCode: 'DE' });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeORDAdmirals(), { now: NOW });
    assert.equal(r.status, 'not_applicable');
    assert.match(r.reason, /oneworld/i);
    assert.match(r.reason, /different alliance/i);
  });

  test('K4: AY Gold (Sapphire) + no flight (operatingAlliance null) → AA Admirals ORD likely_allowed conf 0.6', () => {
    const p = makePassenger({ operatingCarrier: 'XX', operatingAlliance: null });
    const s = makeStatus('oneworld_sapphire');
    const r = evaluateLoungeAccess(p, s, makeORDAdmirals(), { now: NOW });
    assert.equal(r.status, 'likely_allowed');
    assert.equal(r.confidence, 0.6);
    assert.match(r.reason, /oneworld/i);
  });

  test('K5: AY Silver (oneworld_ruby, below Sapphire) + AY → AA Admirals ORD denied (tier gate — Sapphire+ required)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_ruby');
    // With no matching alliance_status rule (tier below Sapphire) and no
    // paid channel, the engine returns 'denied' (default fallback).
    assert.equal(evaluateLoungeAccess(p, s, makeORDAdmirals(), { now: NOW }).status, 'denied');
  });

  test('K6: AY Platinum (oneworld_emerald ≥ Sapphire) + AY → AA Flagship ORD allowed (higher tier still qualifies)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const s = makeStatus('oneworld_emerald');
    assert.equal(evaluateLoungeAccess(p, s, makeORDFlagship(), { now: NOW }).status, 'allowed');
  });

  test('K7: Amex Platinum card (priority_pass + amex_centurion) but no status + AY-flight → AA Admirals ORD denied (all_alliance requires status, cards do not help)', () => {
    // Ryhmä 2 lounges have no PP/paid/amex_centurion channels — the only
    // access path is through oneworld status. Amex Platinum walks up
    // and gets denied.
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const cards: ChannelType[] = ['amex_centurion', 'priority_pass'];
    assert.equal(evaluateLoungeAccess(p, null, makeORDAdmirals(), { now: NOW, passengerCards: cards }).status, 'denied');
  });

  test('K8 (Alaska smoke): AY Gold + AY LAX→SEA → LAX Alaska + SEA Alaska both allowed (Alaska joined oneworld 2021, all_alliance shape applies)', () => {
    const p = makePassenger({ operatingCarrier: 'AY', operatingAlliance: 'oneworld', departureAirport: 'LAX', arrivalAirport: 'SEA', arrivalCountryCode: 'US' });
    const s = makeStatus('oneworld_sapphire');
    assert.equal(evaluateLoungeAccess(p, s, makeLAXAlaska(), { now: NOW }).status, 'allowed');
    assert.equal(evaluateLoungeAccess(p, s, makeSEAAlaska(), { now: NOW }).status, 'allowed');
  });
});
