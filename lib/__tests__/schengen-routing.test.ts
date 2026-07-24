import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isSchengenCountry } from '../schengen';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import { findEntitlementsAtAirport } from '../entitlements/findEntitlementsAtAirport';
import type { PassengerContext, StatusContext, AllianceCode, AirlineRepository, TierRepository } from '../normalization/types';
import type { LoungeInput } from '../engine/types';
import type { AirportInfo, AirportRepository, FlightRequest, LoungeInputWithMeta, Repos, UserInput } from '../entitlements/types';
import type { ServiceType } from '../airport-services/types';

// ─── isSchengenCountry ────────────────────────────────────────────────────────

describe('isSchengenCountry', () => {
  test('FI → true', () => assert.equal(isSchengenCountry('FI'), true));
  test('DE → true', () => assert.equal(isSchengenCountry('DE'), true));
  test('FR → true', () => assert.equal(isSchengenCountry('FR'), true));
  test('RO → true (joined 2024)', () => assert.equal(isSchengenCountry('RO'), true));
  test('BG → true (joined 2024)', () => assert.equal(isSchengenCountry('BG'), true));
  test('HR → true (joined 2023)', () => assert.equal(isSchengenCountry('HR'), true));
  test('GB → false (Brexit)', () => assert.equal(isSchengenCountry('GB'), false));
  test('US → false', () => assert.equal(isSchengenCountry('US'), false));
  test('TH → false', () => assert.equal(isSchengenCountry('TH'), false));
  test('lowercase fi → true', () => assert.equal(isSchengenCountry('fi'), true));
});

// ─── evaluateLoungeAccess Schengen zone check ─────────────────────────────────

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'HEL',
    arrivalAirport:       'FRA',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    ...overrides,
  };
}

function makeStatus(overrides: Partial<StatusContext> = {}): StatusContext {
  return {
    allianceTier: 'oneworld_emerald',
    programCode:  'ay-plus',
    tierName:     'Platinum',
    fastTrack:    true,
    ...overrides,
  };
}

function makeLounge(area: LoungeInput['area'], overrides: Partial<LoungeInput> = {}): LoungeInput {
  return {
    id:           1,
    name:         'Test Lounge',
    terminalId:   null,
    openingHours: null,
    area,
    channels:     [{
      id:             1,
      channelType:    'alliance_status',
      allianceAccess: 'carrier_specific',
      rules:          [{
        id:                 1,
        priority:           100,
        validFrom:          '2020-01-01',
        validTo:            null,
        confidence:         0.99,
        minAllianceTier:    'oneworld_emerald',
        carrierRestriction: ['AY'],
        conditions:         null,
      }],
    }],
    exceptions: [],
    ...overrides,
  };
}

describe('evaluateLoungeAccess — Schengen zone', () => {
  const emerald = makePassenger({ arrivalIsSchengen: false });  // AY Platinum to non-Schengen
  const sapphire = makePassenger({ arrivalIsSchengen: true });  // AY flight to Schengen
  const status = makeStatus({ allianceTier: 'oneworld_emerald' });
  const statusSapphire = makeStatus({ allianceTier: 'oneworld_sapphire' });

  // Platinum Wing (non_schengen) + non-Schengen flight → allowed
  test('non_schengen lounge + non-Schengen destination → access evaluated normally', () => {
    const r = evaluateLoungeAccess(emerald, status, makeLounge('non_schengen'));
    assert.notEqual(r.status, 'physically_unreachable');
    assert.equal(r.status, 'allowed');
  });

  // Platinum Wing (non_schengen) + Schengen flight → physically_unreachable
  test('non_schengen lounge + Schengen destination → physically_unreachable', () => {
    const r = evaluateLoungeAccess(sapphire, status, makeLounge('non_schengen'));
    assert.equal(r.status, 'physically_unreachable');
    assert.equal(r.source, 'schengen_zone_check');
    assert.match(r.reason, /non-Schengen zone/);
  });

  // Finnair Lounge (schengen) + Schengen flight → allowed (sapphire)
  test('schengen lounge + Schengen destination → access evaluated normally', () => {
    const schengenLounge = makeLounge('schengen', {
      channels: [{
        id: 1, channelType: 'alliance_status', allianceAccess: 'carrier_specific',
        rules: [{ id: 1, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.99, minAllianceTier: 'oneworld_sapphire',
          carrierRestriction: ['AY'], conditions: null }],
      }],
    });
    const r = evaluateLoungeAccess(
      makePassenger({ arrivalIsSchengen: true }),
      statusSapphire,
      schengenLounge,
    );
    assert.equal(r.status, 'allowed');
  });

  // Finnair Lounge (schengen) + non-Schengen flight → physically_unreachable
  test('schengen lounge + non-Schengen destination → physically_unreachable', () => {
    const r = evaluateLoungeAccess(
      makePassenger({ arrivalIsSchengen: false }),
      statusSapphire,
      makeLounge('schengen', {
        channels: [{
          id: 1, channelType: 'alliance_status', allianceAccess: 'carrier_specific',
          rules: [{ id: 1, priority: 100, validFrom: '2020-01-01', validTo: null,
            confidence: 0.99, minAllianceTier: 'oneworld_sapphire',
            carrierRestriction: ['AY'], conditions: null }],
        }],
      }),
    );
    assert.equal(r.status, 'physically_unreachable');
    assert.equal(r.source, 'schengen_zone_check');
  });

  // area='all' (default) → no Schengen filtering regardless of destination
  test('area=all + Schengen destination → no zone filter', () => {
    const r = evaluateLoungeAccess(sapphire, status, makeLounge('all'));
    assert.notEqual(r.status, 'physically_unreachable');
  });

  test('area=international + non-Schengen destination → no zone filter', () => {
    const r = evaluateLoungeAccess(emerald, status, makeLounge('international'));
    assert.notEqual(r.status, 'physically_unreachable');
  });

  // arrivalIsSchengen=null (unknown destination) → no zone filter
  test('area=non_schengen + arrivalIsSchengen=null → no zone filter', () => {
    const r = evaluateLoungeAccess(
      makePassenger({ arrivalIsSchengen: null }),
      status,
      makeLounge('non_schengen'),
    );
    assert.notEqual(r.status, 'physically_unreachable');
  });

  // area=undefined (legacy LoungeInput without area) → no zone filter
  test('area=undefined (legacy) → no zone filter', () => {
    const r = evaluateLoungeAccess(sapphire, status, makeLounge(undefined));
    assert.notEqual(r.status, 'physically_unreachable');
  });
});

// ─── findEntitlementsAtAirport — end-to-end Schengen routing ─────────────────

const CARRIER_MAP: Record<string, AllianceCode> = {
  AY: 'oneworld', BA: 'oneworld', LH: 'star_alliance',
};
const airlineRepo: AirlineRepository = {
  getAllianceForCarrier: (code) => CARRIER_MAP[code] ?? null,
};
const tierRepo: TierRepository = {
  getTierForCard: (prog, tier) => {
    const map: Record<string, { allianceTier: any; fastTrack: boolean }> = {
      'ay-plus:Gold':     { allianceTier: 'oneworld_sapphire', fastTrack: true },
      'ay-plus:Platinum': { allianceTier: 'oneworld_emerald',  fastTrack: true },
    };
    return map[`${prog}:${tier}`] ?? null;
  },
};

function makeAirportRepo(
  loungesMap: Record<string, LoungeInputWithMeta[]>,
  countryMap: Record<string, string> = {},
): AirportRepository {
  return {
    getLoungesAtAirport:    (iata) => loungesMap[iata] ?? [],
    getAirportServiceRules: ()     => [],
    getAirportInfo:         (iata): AirportInfo | null => {
      const cc = countryMap[iata];
      return cc ? {
        countryCode:          cc,
        isSchengen:           isSchengenCountry(cc),
        loungeCoverageStatus: 'unverified',
        coverageVerifiedAt:   null,
        coverageSourceUrl:    null,
      } : null;
    },
  };
}

function makeFullLounge(
  id: number,
  area: LoungeInputWithMeta['area'],
  minTier: any,
): LoungeInputWithMeta {
  return {
    id,
    name:                `Lounge ${id}`,
    terminalId:          null,
    openingHours:        null,
    area,
    tier:                'premium',
    loungeClass:         'business',
    locationDescription: null,
    amenities:           null,
    channels: [{
      id,
      channelType:    'alliance_status',
      allianceAccess: 'carrier_specific',
      rules: [{
        id,
        priority:           100,
        validFrom:          '2020-01-01',
        validTo:            null,
        confidence:         0.99,
        minAllianceTier:    minTier,
        carrierRestriction: ['AY'],
        conditions:         null,
      }],
    }],
    exceptions: [],
  };
}

const NOW = new Date('2026-06-14T10:00:00');

describe('findEntitlementsAtAirport — Schengen routing end-to-end', () => {

  // AY1411 HEL→FRA (DE=Schengen): Platinum Wing (non_schengen) → physically_unreachable
  test('AY1411 HEL→FRA + Platinum Wing (non_schengen) → physically_unreachable', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Platinum' }] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY', cabin: 'economy',
      departureAirport: 'HEL', arrivalAirport: 'FRA',
    };
    const repos: Repos = {
      airlines: airlineRepo, tiers: tierRepo,
      airport: makeAirportRepo(
        { HEL: [makeFullLounge(1, 'non_schengen', 'oneworld_emerald')] },
        { FRA: 'DE' },
      ),
    };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    assert.equal(result.lounges[0].access.status, 'physically_unreachable');
    assert.equal(result.lounges[0].access.source, 'schengen_zone_check');
  });

  // AY1 HEL→BKK (TH=non-Schengen) + Platinum Wing (non_schengen) + Platinum status → allowed
  test('AY1 HEL→BKK + Platinum Wing (non_schengen) + Platinum status → allowed', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Platinum' }] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY', cabin: 'economy',
      departureAirport: 'HEL', arrivalAirport: 'BKK',
    };
    const repos: Repos = {
      airlines: airlineRepo, tiers: tierRepo,
      airport: makeAirportRepo(
        { HEL: [makeFullLounge(1, 'non_schengen', 'oneworld_emerald')] },
        { BKK: 'TH' },
      ),
    };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    assert.equal(result.lounges[0].access.status, 'allowed');
  });

  // AY1411 + Finnair Lounge (schengen) + Gold status → allowed
  test('AY1411 HEL→FRA + Finnair Lounge (schengen) + Gold status → allowed', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY', cabin: 'economy',
      departureAirport: 'HEL', arrivalAirport: 'FRA',
    };
    const repos: Repos = {
      airlines: airlineRepo, tiers: tierRepo,
      airport: makeAirportRepo(
        { HEL: [makeFullLounge(1, 'schengen', 'oneworld_sapphire')] },
        { FRA: 'DE' },
      ),
    };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    assert.equal(result.lounges[0].access.status, 'allowed');
  });

  // Unknown arrival airport → arrivalIsSchengen=null → no zone filter
  test('unknown arrival airport → no Schengen filter applied', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Platinum' }] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY', cabin: 'economy',
      departureAirport: 'HEL', arrivalAirport: 'XXX',  // unknown
    };
    const repos: Repos = {
      airlines: airlineRepo, tiers: tierRepo,
      airport: makeAirportRepo(
        { HEL: [makeFullLounge(1, 'non_schengen', 'oneworld_emerald')] },
        {},  // no country map → getAirportInfo returns null
      ),
    };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    // Should evaluate access normally (no zone block)
    assert.equal(result.lounges[0].access.status, 'allowed');
  });

  // IATA not in airports table → getAirportInfo returns null → engine doesn't crash
  test('arrivalAirport IATA not in airports table → engine continues, no Schengen filter', () => {
    const user: UserInput = { statusCards: [] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY', cabin: 'economy',
      departureAirport: 'HEL', arrivalAirport: 'ZZZ',  // no row in airports table
    };
    const repos: Repos = {
      airlines: airlineRepo, tiers: tierRepo,
      airport: makeAirportRepo(
        { HEL: [makeFullLounge(1, 'non_schengen', 'oneworld_emerald')] },
        { /* ZZZ not present → getAirportInfo returns null */ },
      ),
    };
    // Must not throw
    let result: ReturnType<typeof findEntitlementsAtAirport> | undefined;
    assert.doesNotThrow(() => {
      result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    });
    assert.ok(result, 'result is defined');
    // Non-Schengen lounge with unknown destination → no zone block → evaluated by access rules
    assert.notEqual(result!.lounges[0].access.status, 'physically_unreachable');
  });
});
