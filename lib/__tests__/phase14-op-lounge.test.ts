/**
 * Phase 14 v2: OP Lounge by Aspire (HEL, id=4).
 *
 * Access model (after v2 fix):
 *   - op_card:         OP Visa Gold / Platinum / Mastercard World Elite
 *   - alliance_status: star_gold (Senator) + carrier_restriction=['LH']
 *   - paid:            walk-in
 *
 * NOT accepted:
 *   - priority_pass / lounge_key / dragon_pass (removed in Phase 14 fix)
 *   - oneworld_sapphire / all_alliance (removed in v2 — contract-based, not alliance-wide)
 *   - AY passengers (Finnair has own lounge → not in LH carrier_restriction)
 *   - LH passengers without Senator status (star_silver or lower → denied)
 *
 * Sources:
 *   - OP Group opening article 1/2025: contract-based per partner airline
 *   - Secondary source: confirmed Lufthansa as partner
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
    if (prog === 'ay-plus'       && tier === 'Gold')            return { allianceTier: 'oneworld_sapphire', fastTrack: true };
    if (prog === 'lh-miles-more' && tier === 'Senator')         return { allianceTier: 'star_gold',         fastTrack: true };
    if (prog === 'lh-miles-more' && tier === 'FrequentTraveler') return { allianceTier: 'star_silver',       fastTrack: false };
    return null;
  },
};

function makeAirportRepo(lounges: LoungeInputWithMeta[]): AirportRepository {
  return {
    getLoungesAtAirport: (iata) => (iata === 'HEL' ? lounges : []),
    getAirportServiceRules: () => [],
    getAirportInfo: (iata): AirportInfo | null =>
      iata === 'HEL' ? {
        countryCode:          'FI',
        isSchengen:           isSchengenCountry('FI'),
        loungeCoverageStatus: 'unverified',
        coverageVerifiedAt:   null,
        coverageSourceUrl:    null,
      } : null,
  };
}

// ─── Lounge fixtures (mirror DB state after v2 fix) ──────────────────────────

function makeOPLounge(): LoungeInputWithMeta {
  return {
    id:                  4,
    name:                'OP Lounge by Aspire',
    terminalId:          1,
    openingHours:        'Daily 05:00–21:00',
    tier:                'standard',
    loungeClass:         'standard',
    area:                'schengen',
    locationDescription: 'Schengen, Level 3 — Pier B, Gate 22',
    amenities:           ['Buffet', 'Bar', 'WiFi', 'TV lounge'],
    channels: [
      // paid — walk-in
      {
        id: 51, channelType: 'paid', allianceAccess: null,
        rules: [{ id: 51, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.9, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
      // op_card — OP bank cards
      {
        id: 52, channelType: 'op_card', allianceAccess: null,
        rules: [{ id: 52, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.9, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
      // alliance_status — star_gold (Senator), carrier=LH only
      {
        id: 53, channelType: 'alliance_status', allianceAccess: 'carrier_specific',
        rules: [{ id: 53, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.85, minAllianceTier: 'star_gold',
          carrierRestriction: ['LH'], conditions: null }],
      },
    ],
    exceptions: [],
  };
}

// Aspire Gate 27 — has PP channel; used to verify PP still works elsewhere
function makeAspireGate27(): LoungeInputWithMeta {
  return {
    id:                  26,
    name:                'Aspire Lounge by Gate 27',
    terminalId:          1,
    openingHours:        'Daily 05:00–21:00',
    tier:                'standard',
    loungeClass:         'standard',
    area:                'schengen',
    locationDescription: 'Schengen, Level 2 — Gate 27',
    amenities:           ['Buffet', 'WiFi'],
    channels: [
      {
        id: 99, channelType: 'priority_pass', allianceAccess: null,
        rules: [{ id: 99, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.8, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
      {
        id: 100, channelType: 'paid', allianceAccess: null,
        rules: [{ id: 100, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.8, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
    ],
    exceptions: [],
  };
}

const repos: Repos = {
  airlines: airlineRepo,
  tiers:    tierRepo,
  airport:  makeAirportRepo([makeOPLounge(), makeAspireGate27()]),
};

const NOW    = new Date('2026-06-15T10:00:00');
const LH_HEL: FlightRequest = { operatingCarrier: 'LH', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'FRA' };
const AY_HEL: FlightRequest = { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'LHR' };

function getLounge(result: ReturnType<typeof findEntitlementsAtAirport>, name: string) {
  const l = result.lounges.find((l) => l.lounge.name === name);
  assert.ok(l, `Lounge "${name}" not found in result`);
  return l;
}

// ─── OP card access ───────────────────────────────────────────────────────────

describe('OP Lounge by Aspire — op_card channel', () => {

  test('OP Visa Gold (op-card only) → allowed via op_card', () => {
    const user: UserInput = { statusCards: [], cards: ['op_card'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    const l = getLounge(result, 'OP Lounge by Aspire');
    assert.equal(l.access.status, 'allowed');
    assert.ok(l.access.source?.startsWith('channel:'));
  });

  test('OP Visa Platinum (PP + op-card) → allowed via op_card', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass', 'op_card'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'allowed');
  });

  test('OP Mastercard World Elite (LK + op-card) → allowed via op_card', () => {
    const user: UserInput = { statusCards: [], cards: ['lounge_key', 'op_card'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'allowed');
  });
});

// ─── Lufthansa Senator access ─────────────────────────────────────────────────

describe('OP Lounge by Aspire — LH Senator (star_gold)', () => {

  test('LH Senator (star_gold) + LH flight → allowed via alliance_status', () => {
    const user: UserInput = { statusCards: [{ programCode: 'lh-miles-more', tierName: 'Senator' }], cards: [] };
    const result = findEntitlementsAtAirport(user, LH_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'allowed');
  });

  test('LH flight, no status → paid_available (Senator required)', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const result = findEntitlementsAtAirport(user, LH_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'paid_available');
  });

  test('LH Frequent Traveler (star_silver) + LH flight → paid_available (Senator minimum)', () => {
    const user: UserInput = { statusCards: [{ programCode: 'lh-miles-more', tierName: 'FrequentTraveler' }], cards: [] };
    const result = findEntitlementsAtAirport(user, LH_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'paid_available');
  });

  test('AY Finnair Plus Gold + AY flight → paid_available (AY not in carrier_restriction)', () => {
    // Finnair has own lounge — not in LH carrier_restriction for OP Lounge
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }], cards: [] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'paid_available');
  });
});

// ─── PP no longer grants access at OP Lounge ─────────────────────────────────

describe('OP Lounge by Aspire — PP/LK channels removed', () => {

  test('Standalone PP card → paid_available at OP Lounge (no PP channel)', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'paid_available');
  });

  test('PP card → likely_allowed at Aspire Gate 27 (PP channel intact there)', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    // confidence 0.8 → likely_allowed (threshold 0.85 for 'allowed')
    assert.equal(getLounge(result, 'Aspire Lounge by Gate 27').access.status, 'likely_allowed');
  });
});

// ─── Walk-in ──────────────────────────────────────────────────────────────────

describe('OP Lounge by Aspire — paid walk-in', () => {

  test('walk-in (no card, no status) → paid_available', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'paid_available');
  });
});
