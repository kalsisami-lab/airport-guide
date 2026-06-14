import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { findEntitlementsAtAirport } from '../entitlements/findEntitlementsAtAirport';
import { isSchengenCountry } from '../schengen';
import type {
  AirportInfo,
  AirportRepository,
  FlightRequest,
  LoungeInputWithMeta,
  Repos,
  UserInput,
} from '../entitlements/types';
import type { AirlineRepository, AllianceCode, TierRepository } from '../normalization/types';

const CARRIER_MAP: Record<string, AllianceCode> = { AY: 'oneworld' };
const airlineRepo: AirlineRepository = {
  getAllianceForCarrier: (code) => CARRIER_MAP[code] ?? null,
};
const tierRepo: TierRepository = {
  getTierForCard: () => null,
};

function makeAspireLounge(id: number, name: string, openingHours: string): LoungeInputWithMeta {
  return {
    id,
    name,
    terminalId:          null,
    openingHours,
    tier:                'standard',
    loungeClass:         'standard',
    area:                'schengen',
    locationDescription: 'Schengen, Level 2',
    amenities:           ['Buffet', 'Bar', 'WiFi'],
    channels: [
      {
        id:             id * 10 + 1,
        channelType:    'priority_pass',
        allianceAccess: null,
        rules: [{
          id:                 id * 10 + 1,
          priority:           100,
          validFrom:          '2020-01-01',
          validTo:            null,
          confidence:         0.95,
          minAllianceTier:    null,
          carrierRestriction: null,
          conditions:         null,
        }],
      },
      {
        id:             id * 10 + 4,
        channelType:    'paid',
        allianceAccess: null,
        rules: [{
          id:                 id * 10 + 4,
          priority:           50,
          validFrom:          '2020-01-01',
          validTo:            null,
          confidence:         0.95,
          minAllianceTier:    null,
          carrierRestriction: null,
          conditions:         null,
        }],
      },
    ],
    exceptions: [],
  };
}

function makeAirportRepo(
  loungesMap: Record<string, LoungeInputWithMeta[]>,
  countryMap: Record<string, string> = {},
): AirportRepository {
  return {
    getLoungesAtAirport:    (iata) => loungesMap[iata] ?? [],
    getAirportServiceRules: ()     => [],
    getAirportInfo:         (iata): AirportInfo | null => {
      const cc = countryMap[iata];
      return cc ? { countryCode: cc, isSchengen: isSchengenCountry(cc) } : null;
    },
  };
}

// 12:00 — inside Aspire Gate 27 hours (05:00–21:00); outside Gate 13 hours (05:00–09:00)
const NOW = new Date('2026-06-14T12:00:00');

const gate27 = makeAspireLounge(10, 'Aspire Lounge by Gate 27', 'Daily 05:00–21:00');
const gate13 = makeAspireLounge(20, 'Aspire Lounge by Gate 13', 'Daily 05:00–09:00');

const repos: Repos = {
  airlines: airlineRepo,
  tiers:    tierRepo,
  airport:  makeAirportRepo(
    { HEL: [gate27, gate13] },
    { FRA: 'DE', BKK: 'TH' },
  ),
};

const AY_HEL_FRA: FlightRequest = {
  operatingCarrier: 'AY', cabin: 'economy',
  departureAirport: 'HEL', arrivalAirport: 'FRA',
};
const AY_HEL_BKK: FlightRequest = {
  operatingCarrier: 'AY', cabin: 'economy',
  departureAirport: 'HEL', arrivalAirport: 'BKK',
};

describe('Phase 12 — Aspire Lounge (HEL, priority_pass + paid channels, area=schengen)', () => {

  test('PP card + Schengen flight (FRA/DE) → Gate 27 allowed via priority_pass', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL_FRA, repos, { now: NOW });
    const g27 = result.lounges.find((l) => l.lounge.name === 'Aspire Lounge by Gate 27');
    assert.ok(g27, 'Gate 27 should be in result');
    assert.equal(g27.access.status, 'allowed');
    assert.ok(g27.access.source?.startsWith('channel:'), 'source should be channel-based');
  });

  test('no cards + Schengen flight → Gate 27 paid_available', () => {
    const user: UserInput = { statusCards: [] };
    const result = findEntitlementsAtAirport(user, AY_HEL_FRA, repos, { now: NOW });
    const g27 = result.lounges.find((l) => l.lounge.name === 'Aspire Lounge by Gate 27');
    assert.ok(g27);
    assert.equal(g27.access.status, 'paid_available');
  });

  test('PP card + non-Schengen flight (BKK/TH) → Gate 27 physically_unreachable', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL_BKK, repos, { now: NOW });
    const g27 = result.lounges.find((l) => l.lounge.name === 'Aspire Lounge by Gate 27');
    assert.ok(g27);
    assert.equal(g27.access.status, 'physically_unreachable');
    assert.equal(g27.access.source, 'schengen_zone_check');
    assert.match(g27.access.reason, /Schengen/);
  });

  test('unknown arrival airport → no zone block → paid_available', () => {
    const user: UserInput = { statusCards: [] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY', cabin: 'economy',
      departureAirport: 'HEL', arrivalAirport: 'XXX',  // not in countryMap → null
    };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    const g27 = result.lounges.find((l) => l.lounge.name === 'Aspire Lounge by Gate 27');
    assert.ok(g27);
    // Unknown arrival → arrivalIsSchengen=null → no zone block → falls through to paid
    assert.equal(g27.access.status, 'paid_available');
  });

  test('Gate 13 is closed at 12:00 (hours 05:00–09:00)', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL_FRA, repos, { now: NOW });
    const g13 = result.lounges.find((l) => l.lounge.name === 'Aspire Lounge by Gate 13');
    assert.ok(g13);
    assert.equal(g13.access.status, 'closed');
    assert.equal(g13.access.source, 'opening_hours');
  });

  test('Gate 27 open at 12:00 (hours 05:00–21:00) + PP card → allowed', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL_FRA, repos, { now: NOW });
    const g27 = result.lounges.find((l) => l.lounge.name === 'Aspire Lounge by Gate 27');
    assert.ok(g27);
    assert.notEqual(g27.access.status, 'closed');
    assert.equal(g27.access.status, 'allowed');
  });
});
