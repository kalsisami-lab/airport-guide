import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { findEntitlementsAtAirport } from '../findEntitlementsAtAirport';
import type {
  AirportInfo,
  AirportRepository,
  AirportServiceRuleInput,
  FlightRequest,
  Repos,
  UserInput,
} from '../types';
import { isSchengenCountry } from '../../schengen';
import type { ServiceType } from '../../airport-services/types';
import type { AirlineRepository, AllianceCode, TierRepository } from '../../normalization/types';
import type { LoungeInputWithMeta } from '../types';

// ─── Mock repositories ────────────────────────────────────────────────────────

const CARRIER_MAP: Record<string, AllianceCode> = {
  AY: 'oneworld', BA: 'oneworld', IB: 'oneworld',
  LH: 'star_alliance', LX: 'star_alliance', UA: 'star_alliance',
  AF: 'skyteam', KL: 'skyteam',
  EK: null, U2: null,
};

const airlineRepo: AirlineRepository = {
  getAllianceForCarrier: (code) => CARRIER_MAP[code] ?? null,
};

type TierEntry = { allianceTier: Parameters<TierRepository['getTierForCard']>[0] extends string ? any : never; fastTrack: boolean };
const TIER_MAP: Record<string, { allianceTier: any; fastTrack: boolean }> = {
  'ay-plus:Gold':          { allianceTier: 'oneworld_sapphire', fastTrack: true  },
  'ay-plus:Platinum':      { allianceTier: 'oneworld_emerald',  fastTrack: true  },
  'lh-miles-more:Senator': { allianceTier: 'star_gold',         fastTrack: true  },
};

const tierRepo: TierRepository = {
  getTierForCard: (prog, tier) => TIER_MAP[`${prog}:${tier}`] ?? null,
};

// Helper: make a minimal LoungeInputWithMeta
function makeLounge(
  id: number,
  name: string,
  opts: {
    terminalId?: number;
    tier?: string;
    loungeClass?: string;
    openingHours?: string;
    channelType?: 'alliance_status' | 'airline_own' | 'paid';
    allianceAccess?: 'all_alliance' | 'carrier_specific' | null;
    minAllianceTier?: any;
    carrierRestriction?: string[];
  } = {},
): LoungeInputWithMeta {
  const {
    terminalId = 1,
    tier = 'premium',
    loungeClass = 'business',
    openingHours = 'Daily 05:00–22:00',
    channelType = 'alliance_status',
    allianceAccess = 'all_alliance',
    minAllianceTier = 'oneworld_sapphire',
    carrierRestriction,
  } = opts;

  return {
    id,
    name,
    terminalId,
    openingHours,
    tier,
    loungeClass,
    area: 'all',
    locationDescription: null,
    amenities: null,
    channels: [{
      id,
      channelType,
      allianceAccess: channelType === 'alliance_status' ? allianceAccess : null,
      rules: [{
        id,
        priority:           100,
        validFrom:          '2020-01-01',
        validTo:            null,
        confidence:         0.95,
        minAllianceTier:    channelType === 'alliance_status' ? minAllianceTier : null,
        carrierRestriction: carrierRestriction ?? null,
        conditions:         null,
      }],
    }],
    exceptions: [],
  };
}

function makeServiceRule(overrides: Partial<AirportServiceRuleInput> = {}): AirportServiceRuleInput {
  return {
    id:                 1,
    priority:           100,
    validFrom:          '2020-01-01',
    validTo:            null,
    confidence:         0.95,
    action:             'allow',
    minAllianceTier:    null,
    carrierRestriction: null,
    conditions:         null,
    provider:           null,
    notes:              null,
    tierSemantics:      'local',  // §64 default
    ...overrides,
  };
}

type CoverageOverride = {
  status:     'verified_none' | 'verified_seeded' | 'unverified';
  verifiedAt?: string;
  sourceUrl?:  string;
};

function makeAirportRepo(
  loungesMap: Record<string, LoungeInputWithMeta[]>,
  serviceRulesMap: Partial<Record<string, Partial<Record<ServiceType, AirportServiceRuleInput[]>>>> = {},
  countryMap: Record<string, string> = {},
  coverageMap: Record<string, CoverageOverride> = {},
): AirportRepository {
  return {
    getLoungesAtAirport:    (iata) => loungesMap[iata] ?? [],
    getAirportServiceRules: (iata, serviceType) => serviceRulesMap[iata]?.[serviceType] ?? [],
    getAirportInfo:         (iata): AirportInfo | null => {
      const cc = countryMap[iata];
      if (!cc) return null;
      const cov = coverageMap[iata];
      return {
        countryCode:          cc,
        isSchengen:           isSchengenCountry(cc),
        loungeCoverageStatus: cov?.status ?? 'unverified',
        coverageVerifiedAt:   cov?.verifiedAt ?? null,
        coverageSourceUrl:    cov?.sourceUrl ?? null,
      };
    },
  };
}

const NOW = new Date('2025-05-16T10:00:00');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('findEntitlementsAtAirport', () => {

  test('allowed lounges appear before denied lounges (sort order)', () => {
    const user: UserInput = {
      statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }],
    };
    const flight: FlightRequest = {
      operatingCarrier:  'AY',
      cabin:             'economy',
      departureAirport:  'HEL',
      arrivalAirport:    'LHR',
      departureTerminalId: 1,
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({
        HEL: [
          // Denied: needs emerald, user has sapphire
          makeLounge(1, 'Premium Wing', { minAllianceTier: 'oneworld_emerald', terminalId: 1 }),
          // Allowed: needs sapphire, user has sapphire
          makeLounge(2, 'Business Lounge', { minAllianceTier: 'oneworld_sapphire', terminalId: 1 }),
        ],
      }),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.lounges.length, 2);
    assert.equal(result.lounges[0].lounge.name, 'Business Lounge');
    assert.equal(result.lounges[0].access.status, 'allowed');
    assert.equal(result.lounges[1].lounge.name, 'Premium Wing');
    assert.equal(result.lounges[1].access.status, 'denied');
  });

  test('AY Gold + AY-lento: carrier_specific Finnair lounge → allowed', () => {
    const user: UserInput = {
      statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }],
    };
    const flight: FlightRequest = {
      operatingCarrier: 'AY',
      cabin:            'economy',
      departureAirport: 'HEL',
      arrivalAirport:   'LHR',
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({
        HEL: [
          makeLounge(1, 'Finnair Lounge', {
            channelType:        'alliance_status',
            allianceAccess:     'carrier_specific',
            minAllianceTier:    'oneworld_sapphire',
            carrierRestriction: ['AY'],
          }),
        ],
      }),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.lounges[0].access.status, 'allowed');
    assert.equal(result.status?.allianceTier, 'oneworld_sapphire');
  });

  test('no status cards → all alliance lounges denied', () => {
    const user: UserInput = { statusCards: [] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY',
      cabin:            'economy',
      departureAirport: 'HEL',
      arrivalAirport:   'LHR',
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({
        HEL: [makeLounge(1, 'Sapphire Lounge', { minAllianceTier: 'oneworld_sapphire' })],
      }),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.status, null);
    assert.equal(result.lounges[0].access.status, 'denied');
  });

  test('EK economy, no status → all lounges denied', () => {
    const user: UserInput = { statusCards: [] };
    const flight: FlightRequest = {
      operatingCarrier: 'EK',
      cabin:            'economy',
      departureAirport: 'DXB',
      arrivalAirport:   'LHR',
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({
        DXB: [makeLounge(1, 'Alliance Lounge', { minAllianceTier: 'oneworld_sapphire' })],
      }),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.passenger.operatingAlliance, null);
    assert.equal(result.lounges[0].access.status, 'denied');
  });

  test('EK airline_own lounge accessible without status', () => {
    const user: UserInput = { statusCards: [] };
    const flight: FlightRequest = {
      operatingCarrier: 'EK',
      cabin:            'economy',
      departureAirport: 'DXB',
      arrivalAirport:   'LHR',
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({
        DXB: [
          makeLounge(1, 'Emirates Lounge', {
            channelType:        'airline_own',
            allianceAccess:     null,
            carrierRestriction: ['EK'],
          }),
        ],
      }),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.lounges[0].access.status, 'allowed');
  });

  test('empty airport → empty lounge list', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY',
      cabin:            'economy',
      departureAirport: 'XXX',  // unknown airport
      arrivalAirport:   'HEL',
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({}),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.lounges.length, 0);
  });

  test('fast track: LH Senator + LX-lento FRA → available', () => {
    const user: UserInput = {
      statusCards: [{ programCode: 'lh-miles-more', tierName: 'Senator' }],
    };
    const flight: FlightRequest = {
      operatingCarrier: 'LX',
      cabin:            'economy',
      departureAirport: 'FRA',
      arrivalAirport:   'ZRH',
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({ FRA: [] }, {
        FRA: { fast_track_security: [makeServiceRule({ minAllianceTier: 'star_gold' })] },
      }),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.fastTrack.available, true);
    assert.ok(result.fastTrack.reason.includes('star_gold'));
  });

  test('fast track: no status → not available', () => {
    const user: UserInput = { statusCards: [] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY',
      cabin:            'economy',
      departureAirport: 'HEL',
      arrivalAirport:   'LHR',
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({ HEL: [] }, {
        HEL: { fast_track_security: [makeServiceRule({ minAllianceTier: 'oneworld_sapphire' })] },
      }),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.fastTrack.available, false);
  });

  test('physically_unreachable sorts before denied', () => {
    const user: UserInput = { statusCards: [] };
    const flight: FlightRequest = {
      operatingCarrier:    'AY',
      cabin:               'economy',
      departureAirport:    'HEL',
      arrivalAirport:      'LHR',
      departureTerminalId: 1,
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({
        HEL: [
          // In wrong terminal → physically_unreachable
          makeLounge(1, 'Unreachable Lounge', { terminalId: 9 }),
          // No status → denied
          makeLounge(2, 'Denied Lounge',      { terminalId: 1 }),
        ],
      }),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.lounges[0].access.status, 'physically_unreachable');
    assert.equal(result.lounges[1].access.status, 'denied');
  });

  test('PassengerContext is returned and correct', () => {
    const user: UserInput = { statusCards: [] };
    const flight: FlightRequest = {
      operatingCarrier:     'BA',
      marketingCarrier:     'IB',
      cabin:                'business',
      departureAirport:     'LHR',
      arrivalAirport:       'MAD',
      departureCountryCode: 'GB',
    };
    const repos: Repos = {
      airlines: airlineRepo,
      tiers:    tierRepo,
      airport:  makeAirportRepo({}),
    };

    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });

    assert.equal(result.passenger.operatingCarrier,  'BA');
    assert.equal(result.passenger.marketingCarrier,  'IB');
    assert.equal(result.passenger.operatingAlliance, 'oneworld');
    assert.equal(result.passenger.cabin,             'business');
  });

  // ── §67 lounge coverage propagation ─────────────────────────────────────────

  describe('§67 lounge coverage', () => {
    const baseFlight: FlightRequest = {
      operatingCarrier: 'AY',
      cabin:            'economy',
      departureAirport: 'BOO',
      arrivalAirport:   'HEL',
    };
    const emptyUser: UserInput = { statusCards: [] };

    test('verified_none airport propagates coverage to output', () => {
      const repos: Repos = {
        airlines: airlineRepo,
        tiers:    tierRepo,
        airport:  makeAirportRepo(
          { BOO: [] },
          {},
          { BOO: 'NO', HEL: 'FI' },
          { BOO: { status: 'verified_none', verifiedAt: '2026-07-24', sourceUrl: 'https://example/59' } },
        ),
      };
      const result = findEntitlementsAtAirport(emptyUser, baseFlight, repos, { now: NOW });

      assert.equal(result.lounges.length, 0);
      assert.equal(result.coverage?.status,     'verified_none');
      assert.equal(result.coverage?.verifiedAt, '2026-07-24');
      assert.equal(result.coverage?.sourceUrl,  'https://example/59');
    });

    test('unverified airport returns coverage.status=unverified (default)', () => {
      const repos: Repos = {
        airlines: airlineRepo,
        tiers:    tierRepo,
        airport:  makeAirportRepo(
          { MAD: [] },
          {},
          { MAD: 'ES', HEL: 'FI' },
        ),
      };
      const flight: FlightRequest = { ...baseFlight, departureAirport: 'MAD' };
      const result = findEntitlementsAtAirport(emptyUser, flight, repos, { now: NOW });

      assert.equal(result.coverage?.status,     'unverified');
      assert.equal(result.coverage?.verifiedAt, null);
      assert.equal(result.coverage?.sourceUrl,  null);
    });

    test('unknown departure IATA (not in airports table) → coverage is null', () => {
      const repos: Repos = {
        airlines: airlineRepo,
        tiers:    tierRepo,
        airport:  makeAirportRepo({}, {}, { HEL: 'FI' }),
      };
      const flight: FlightRequest = { ...baseFlight, departureAirport: 'ZZZ' };
      const result = findEntitlementsAtAirport(emptyUser, flight, repos, { now: NOW });

      assert.equal(result.coverage, null);
    });
  });
});
