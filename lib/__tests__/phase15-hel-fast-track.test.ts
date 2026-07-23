/**
 * Phase 15: HEL fast_track_security — new rules
 *
 * Rules added in this phase:
 *   id=12  Finnair Plus Silver (oneworld_ruby, AY only)
 *   id=13  Business/First class cabin
 *   id=14  Amex Platinum Finland (provider=amex_centurion)
 *   id=15  Nordea Platinum / Black (provider=nordea_fast_track)
 *   id=16  Aktia Visa Infinite (provider=aktia_fast_track)
 *
 * Existing rules (regression):
 *   id=1   oneworld_sapphire → AY Gold still allowed
 *   id=2   star_gold → LH Senator still allowed
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { findEntitlementsAtAirport } from '../entitlements/findEntitlementsAtAirport';
import { isSchengenCountry } from '../schengen';
import type {
  AirportInfo, AirportRepository, FlightRequest,
  LoungeInputWithMeta, Repos, UserInput,
} from '../entitlements/types';
import type { AirlineRepository, AllianceCode, TierRepository } from '../normalization/types';
import type { AirportServiceRuleInput, ServiceType } from '../airport-services/types';

// ─── Mock repos ───────────────────────────────────────────────────────────────

const CARRIER_ALLIANCE: Record<string, AllianceCode> = {
  AY: 'oneworld',
  LH: 'star_alliance',
  SK: 'star_alliance',
};

const airlineRepo: AirlineRepository = {
  getAllianceForCarrier: (code) => CARRIER_ALLIANCE[code] ?? null,
};

const tierRepo: TierRepository = {
  getTierForCard: (prog, tier) => {
    if (prog === 'ay-plus' && tier === 'Silver')    return { allianceTier: 'oneworld_ruby',      fastTrack: false };
    if (prog === 'ay-plus' && tier === 'Gold')      return { allianceTier: 'oneworld_sapphire',  fastTrack: true  };
    if (prog === 'ay-plus' && tier === 'Platinum')  return { allianceTier: 'oneworld_emerald',   fastTrack: true  };
    if (prog === 'lh-miles-more' && tier === 'Senator') return { allianceTier: 'star_gold',      fastTrack: true  };
    return null;
  },
};

const HEL_FT_RULES: AirportServiceRuleInput[] = [
  // existing (alliance_defined: standard oneworld/star/skyteam tier benefits)
  { id: 1,  priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.99, action: 'allow', provider: null,                minAllianceTier: 'oneworld_sapphire', carrierRestriction: null,       conditions: null, notes: null, tierSemantics: 'alliance_defined' },
  { id: 2,  priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.95, action: 'allow', provider: null,                minAllianceTier: 'star_gold',         carrierRestriction: null,       conditions: null, notes: null, tierSemantics: 'alliance_defined' },
  { id: 3,  priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.90, action: 'allow', provider: null,                minAllianceTier: 'skyteam_elite_plus', carrierRestriction: null,      conditions: null, notes: null, tierSemantics: 'alliance_defined' },
  // phase 15
  { id: 12, priority: 80,  validFrom: '2020-01-01', validTo: null, confidence: 0.95, action: 'allow', provider: null,                minAllianceTier: 'oneworld_ruby',     carrierRestriction: ['AY'],     conditions: null, notes: 'Finnair Plus Silver', tierSemantics: 'alliance_defined' },
  { id: 13, priority: 70,  validFrom: '2020-01-01', validTo: null, confidence: 0.90, action: 'allow', provider: null,                minAllianceTier: null,                carrierRestriction: null,       conditions: { op: 'in', field: 'passenger.cabin', values: ['business', 'first'] }, notes: 'Business/First class cabin', tierSemantics: 'local' },
  { id: 14, priority: 60,  validFrom: '2020-01-01', validTo: null, confidence: 0.90, action: 'allow', provider: 'amex_centurion',    minAllianceTier: null,                carrierRestriction: null,       conditions: null, notes: 'Amex Platinum Finland', tierSemantics: 'local' },
  { id: 15, priority: 60,  validFrom: '2020-01-01', validTo: null, confidence: 0.90, action: 'allow', provider: 'nordea_fast_track', minAllianceTier: null,                carrierRestriction: null,       conditions: null, notes: 'Nordea Platinum / Black', tierSemantics: 'local' },
  { id: 16, priority: 60,  validFrom: '2020-01-01', validTo: null, confidence: 0.90, action: 'allow', provider: 'aktia_fast_track',  minAllianceTier: null,                carrierRestriction: null,       conditions: null, notes: 'Aktia Visa Infinite', tierSemantics: 'local' },
];

function makeAirportRepo(): AirportRepository {
  return {
    getLoungesAtAirport: () => [],
    getAirportServiceRules: (_iata: string, svc: ServiceType) =>
      svc === 'fast_track_security' ? HEL_FT_RULES : [],
    getAirportInfo: (iata): AirportInfo | null =>
      iata === 'HEL' ? { countryCode: 'FI', isSchengen: isSchengenCountry('FI') } : null,
  };
}

const repos: Repos = {
  airlines: airlineRepo,
  tiers:    tierRepo,
  airport:  makeAirportRepo(),
};

const NOW = new Date('2026-06-15T10:00:00');
const AY_HEL_ECO: FlightRequest = { operatingCarrier: 'AY', cabin: 'economy',  departureAirport: 'HEL', arrivalAirport: 'LHR' };
const AY_HEL_BUS: FlightRequest = { operatingCarrier: 'AY', cabin: 'business', departureAirport: 'HEL', arrivalAirport: 'LHR' };
const AY_HEL_FST: FlightRequest = { operatingCarrier: 'AY', cabin: 'first',    departureAirport: 'HEL', arrivalAirport: 'JFK' };
const LH_HEL_ECO: FlightRequest = { operatingCarrier: 'LH', cabin: 'economy',  departureAirport: 'HEL', arrivalAirport: 'FRA' };

function ft(user: UserInput, flight: FlightRequest) {
  return findEntitlementsAtAirport(user, flight, repos, { now: NOW }).fastTrack;
}

// ─── Tier-based ───────────────────────────────────────────────────────────────

describe('HEL Fast Track — taso­kortti', () => {

  test('AY Silver (oneworld_ruby, AY) → allowed', () => {
    const r = ft({ statusCards: [{ programCode: 'ay-plus', tierName: 'Silver' }], cards: [] }, AY_HEL_ECO);
    assert.equal(r.available, true);
  });

  test('AY Gold (oneworld_sapphire) → allowed (regressio)', () => {
    const r = ft({ statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }], cards: [] }, AY_HEL_ECO);
    assert.equal(r.available, true);
  });

  test('LH Senator (star_gold) → allowed (regressio)', () => {
    const r = ft({ statusCards: [{ programCode: 'lh-miles-more', tierName: 'Senator' }], cards: [] }, LH_HEL_ECO);
    assert.equal(r.available, true);
  });

  test('Ei tasokorttia, economy → denied', () => {
    const r = ft({ statusCards: [], cards: [] }, AY_HEL_ECO);
    assert.equal(r.available, false);
  });

  test('AY Silver + SK flight (ei AY) → denied (carrier_restriction)', () => {
    const flight: FlightRequest = { operatingCarrier: 'SK', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'ARN' };
    const r = ft({ statusCards: [{ programCode: 'ay-plus', tierName: 'Silver' }], cards: [] }, flight);
    assert.equal(r.available, false);
  });
});

// ─── Cabin-based ─────────────────────────────────────────────────────────────

describe('HEL Fast Track — luokka', () => {

  test('Business class → allowed', () => {
    const r = ft({ statusCards: [], cards: [] }, AY_HEL_BUS);
    assert.equal(r.available, true);
  });

  test('First class → allowed', () => {
    const r = ft({ statusCards: [], cards: [] }, AY_HEL_FST);
    assert.equal(r.available, true);
  });
});

// ─── Card-based ───────────────────────────────────────────────────────────────

describe('HEL Fast Track — luottokortti', () => {

  test('Amex Platinum FI → allowed', () => {
    const r = ft({ statusCards: [], cards: [], fastTrackCards: ['amex_centurion'] }, AY_HEL_ECO);
    assert.equal(r.available, true);
  });

  test('Nordea Platinum → allowed', () => {
    const r = ft({ statusCards: [], cards: [], fastTrackCards: ['nordea_fast_track'] }, AY_HEL_ECO);
    assert.equal(r.available, true);
  });

  test('Nordea Black → allowed', () => {
    const r = ft({ statusCards: [], cards: [], fastTrackCards: ['nordea_fast_track'] }, AY_HEL_ECO);
    assert.equal(r.available, true);
  });

  test('Aktia Visa Infinite → allowed', () => {
    const r = ft({ statusCards: [], cards: [], fastTrackCards: ['aktia_fast_track'] }, AY_HEL_ECO);
    assert.equal(r.available, true);
  });

  test('OP Visa Platinum (ei fast track providereitä) → denied', () => {
    // OP Visa Platinum has priority_pass loungeAccess but no fastTrackProviders
    const r = ft({ statusCards: [], cards: ['priority_pass'], fastTrackCards: [] }, AY_HEL_ECO);
    assert.equal(r.available, false);
  });

  test('Pelkkä Priority Pass (ei FT-korttietu) → denied', () => {
    const r = ft({ statusCards: [], cards: ['priority_pass'], fastTrackCards: [] }, AY_HEL_ECO);
    assert.equal(r.available, false);
  });
});
