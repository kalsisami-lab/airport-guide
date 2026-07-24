/**
 * Phase 13 regression tests — four bug fixes:
 *   A: Standalone Priority Pass card → grants priority_pass channel
 *   B: No card/no status + airport → engine returns paid_available lounges
 *   C: EntitlementLoungeCard renders Schengen/Non-Schengen zone chip
 *   D: LH FCL FRA: cabin condition — Senator economy denied, First allowed
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { findEntitlementsAtAirport } from '../entitlements/findEntitlementsAtAirport';
import { isSchengenCountry } from '../schengen';
import EntitlementLoungeCard from '../../components/EntitlementLoungeCard';
import type {
  AirportInfo,
  AirportRepository,
  FlightRequest,
  LoungeInputWithMeta,
  LoungeEntitlement,
  Repos,
  UserInput,
} from '../entitlements/types';
import type { AirlineRepository, AllianceCode, TierRepository } from '../normalization/types';
import type { AccessResult } from '../engine/types';

// ─── Shared mock infrastructure ───────────────────────────────────────────────

const CARRIER_MAP: Record<string, AllianceCode> = {
  AY: 'oneworld',
  LH: 'star_alliance',
};

const airlineRepo: AirlineRepository = {
  getAllianceForCarrier: (code) => CARRIER_MAP[code] ?? null,
};

const TIER_MAP: Record<string, { allianceTier: any; fastTrack: boolean }> = {
  'ay-plus:Gold':          { allianceTier: 'oneworld_sapphire', fastTrack: true },
  'lh-miles-more:Senator': { allianceTier: 'star_gold',         fastTrack: true },
};

const tierRepo: TierRepository = {
  getTierForCard: (prog, tier) => TIER_MAP[`${prog}:${tier}`] ?? null,
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

const NOW = new Date('2026-06-14T12:00:00');

// ─── Lounge factories ─────────────────────────────────────────────────────────

function makePPLounge(id: number, name: string): LoungeInputWithMeta {
  return {
    id,
    name,
    terminalId:          null,
    openingHours:        'Daily 05:00–21:00',
    tier:                'standard',
    loungeClass:         'standard',
    area:                'schengen',
    locationDescription: 'Schengen, Level 2',
    amenities:           ['Buffet', 'WiFi'],
    channels: [
      {
        id:             id * 10 + 1,
        channelType:    'priority_pass',
        allianceAccess: null,
        rules: [{
          id: id * 10 + 1, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.95, minAllianceTier: null, carrierRestriction: null, conditions: null,
        }],
      },
      {
        id:             id * 10 + 2,
        channelType:    'paid',
        allianceAccess: null,
        rules: [{
          id: id * 10 + 2, priority: 50, validFrom: '2020-01-01', validTo: null,
          confidence: 0.95, minAllianceTier: null, carrierRestriction: null, conditions: null,
        }],
      },
    ],
    exceptions: [],
  };
}

function makeFCLLounge(): LoungeInputWithMeta {
  return {
    id:                  9,
    name:                'Lufthansa First Class Lounge',
    terminalId:          null,
    openingHours:        null,
    tier:                'premium',
    loungeClass:         'first',
    area:                'all',
    locationDescription: null,
    amenities:           null,
    channels: [{
      id:             13,
      channelType:    'airline_own',
      allianceAccess: null,
      rules: [{
        id:                 13,
        priority:           100,
        validFrom:          '2020-01-01',
        validTo:            null,
        confidence:         0.95,
        minAllianceTier:    null,
        carrierRestriction: ['LH', 'LX', 'OS', 'SN'],
        // Phase 13 fix: was NULL, now requires first class cabin
        conditions: { op: 'in', field: 'passenger.cabin', values: ['first'] },
      }],
    }],
    exceptions: [],
  };
}

function makeDeniedAccess(): AccessResult {
  return { status: 'denied', confidence: 0.9, reason: 'no matching rule', guest_allowed: false, source: 'default' };
}

// ─── Bug A — Standalone Priority Pass ─────────────────────────────────────────

describe('Bug A — Standalone Priority Pass card grants access', () => {

  const repos: Repos = {
    airlines: airlineRepo,
    tiers:    tierRepo,
    airport:  makeAirportRepo(
      { HEL: [makePPLounge(10, 'Aspire Lounge by Gate 27')] },
      { FRA: 'DE' },
    ),
  };

  const flight: FlightRequest = {
    operatingCarrier: 'AY', cabin: 'economy',
    departureAirport: 'HEL', arrivalAirport: 'FRA',
  };

  test('standalone PP card (cards:[priority_pass]) → Aspire allowed via priority_pass', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    const lounge = result.lounges[0];
    assert.equal(lounge.access.status, 'allowed');
    assert.ok(lounge.access.source?.startsWith('channel:'), 'source should be channel-based');
  });

  test('no PP card → Aspire paid_available, not allowed', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    assert.equal(result.lounges[0].access.status, 'paid_available');
  });

  test('Finnair Gold status alone (no PP card) → Aspire paid_available', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }], cards: [] };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    assert.equal(result.lounges[0].access.status, 'paid_available');
  });
});

// ─── Bug B — Engine returns paid_available without card/status ────────────────

describe('Bug B — Engine returns paid_available lounges with no credentials', () => {

  const repos: Repos = {
    airlines: airlineRepo,
    tiers:    tierRepo,
    airport:  makeAirportRepo(
      { HEL: [makePPLounge(10, 'Aspire Lounge by Gate 27')] },
      { FRA: 'DE' },
    ),
  };

  test('statusCards=[] + cards=[] → paid_available (engine handles no-auth correctly)', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY', cabin: 'economy',
      departureAirport: 'HEL', arrivalAirport: 'FRA',
    };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    assert.equal(result.lounges.length, 1);
    assert.equal(result.lounges[0].access.status, 'paid_available');
    assert.equal(result.status, null);
    // Note: UI display of these results requires useEntitlements.ts hook fix (guard
    // changed from `!airportIata || (!q.card && !q.status)` → `!airportIata`)
  });

  test('unknown arrival airport + no credentials → still returns paid_available', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const flight: FlightRequest = {
      operatingCarrier: 'AY', cabin: 'economy',
      departureAirport: 'HEL', arrivalAirport: 'XXX',
    };
    const result = findEntitlementsAtAirport(user, flight, repos, { now: NOW });
    assert.equal(result.lounges[0].access.status, 'paid_available');
  });
});

// ─── Bug C — Schengen zone chip in EntitlementLoungeCard ─────────────────────

function makeEntitlement(area: LoungeInputWithMeta['area'], name = 'Test Lounge'): LoungeEntitlement {
  return {
    lounge: {
      id:                  1,
      name,
      terminalId:          null,
      openingHours:        null,
      tier:                'standard',
      loungeClass:         'standard',
      area:                area ?? 'all',
      locationDescription: null,
      amenities:           null,
    },
    access: makeDeniedAccess(),
  };
}

describe('Bug C — EntitlementLoungeCard zone chip visibility', () => {

  test('area=schengen → renders "Schengen" chip', () => {
    const html = renderToStaticMarkup(
      createElement(EntitlementLoungeCard, { entitlement: makeEntitlement('schengen') }),
    );
    assert.ok(html.includes('Schengen'), 'should contain "Schengen"');
    assert.ok(!html.includes('Non-Schengen'), 'should NOT contain "Non-Schengen"');
  });

  test('area=non_schengen → renders "Non-Schengen" chip', () => {
    const html = renderToStaticMarkup(
      createElement(EntitlementLoungeCard, { entitlement: makeEntitlement('non_schengen') }),
    );
    assert.ok(html.includes('Non-Schengen'), 'should contain "Non-Schengen"');
  });

  test('area=all → no zone chip', () => {
    const html = renderToStaticMarkup(
      createElement(EntitlementLoungeCard, { entitlement: makeEntitlement('all') }),
    );
    // AREA_LABEL for 'all' is '' → badge condition is falsy → no chip
    assert.ok(!html.includes('Non-Schengen'), 'no zone chip for area=all');
    assert.ok(!html.includes('>Schengen<'), 'no Schengen chip for area=all');
  });

  test('area=international → no schengen/non-schengen chip', () => {
    const html = renderToStaticMarkup(
      createElement(EntitlementLoungeCard, { entitlement: makeEntitlement('international') }),
    );
    assert.ok(!html.includes('Non-Schengen'));
    assert.ok(!html.includes('>Schengen<'));
  });

  test('two cards with same name but different areas show different chips', () => {
    const schengenHtml = renderToStaticMarkup(
      createElement(EntitlementLoungeCard, {
        entitlement: makeEntitlement('schengen', 'Finnair Lounge'),
      }),
    );
    const nonSchengenHtml = renderToStaticMarkup(
      createElement(EntitlementLoungeCard, {
        entitlement: makeEntitlement('non_schengen', 'Finnair Lounge'),
      }),
    );
    assert.ok(schengenHtml.includes('Schengen'));
    assert.ok(nonSchengenHtml.includes('Non-Schengen'));
    // Critically, the non-schengen card must NOT show "Schengen" as a standalone chip
    assert.ok(!nonSchengenHtml.includes('>Schengen<'));
  });
});

// ─── Bug D — LH FCL FRA: conditions fix ──────────────────────────────────────

describe('Bug D — LH First Class Lounge: cabin=first required', () => {

  const fclRepos: Repos = {
    airlines: airlineRepo,
    tiers:    tierRepo,
    airport:  makeAirportRepo({ FRA: [makeFCLLounge()] }, { LHR: 'GB' }),
  };

  const LH_FRA_LHR = (cabin: 'economy' | 'business' | 'first'): FlightRequest => ({
    operatingCarrier: 'LH', cabin,
    departureAirport: 'FRA', arrivalAirport: 'LHR',
  });

  test('LH Senator + economy → FCL denied (conditions check: cabin not first)', () => {
    const user: UserInput = { statusCards: [{ programCode: 'lh-miles-more', tierName: 'Senator' }], cards: [] };
    const result = findEntitlementsAtAirport(user, LH_FRA_LHR('economy'), fclRepos, { now: NOW });
    const fcl = result.lounges.find((l) => l.lounge.name === 'Lufthansa First Class Lounge');
    assert.ok(fcl, 'FCL should be in lounge list');
    assert.equal(fcl.access.status, 'denied');
  });

  test('LH no-status + business → FCL denied (only first qualifies)', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const result = findEntitlementsAtAirport(user, LH_FRA_LHR('business'), fclRepos, { now: NOW });
    const fcl = result.lounges.find((l) => l.lounge.name === 'Lufthansa First Class Lounge');
    assert.ok(fcl);
    assert.equal(fcl.access.status, 'denied');
  });

  test('LH no-status + cabin=first → FCL allowed', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const result = findEntitlementsAtAirport(user, LH_FRA_LHR('first'), fclRepos, { now: NOW });
    const fcl = result.lounges.find((l) => l.lounge.name === 'Lufthansa First Class Lounge');
    assert.ok(fcl);
    assert.equal(fcl.access.status, 'allowed');
  });

  test('LH Senator + first → FCL allowed (status irrelevant — cabin check passes)', () => {
    const user: UserInput = { statusCards: [{ programCode: 'lh-miles-more', tierName: 'Senator' }], cards: [] };
    const result = findEntitlementsAtAirport(user, LH_FRA_LHR('first'), fclRepos, { now: NOW });
    const fcl = result.lounges.find((l) => l.lounge.name === 'Lufthansa First Class Lounge');
    assert.ok(fcl);
    assert.equal(fcl.access.status, 'allowed');
  });

  test('non-LH carrier in first class → FCL denied (carrier restriction)', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const result = findEntitlementsAtAirport(
      user,
      { operatingCarrier: 'AY', cabin: 'first', departureAirport: 'FRA', arrivalAirport: 'LHR' },
      fclRepos,
      { now: NOW },
    );
    const fcl = result.lounges.find((l) => l.lounge.name === 'Lufthansa First Class Lounge');
    assert.ok(fcl);
    assert.equal(fcl.access.status, 'denied');
  });
});
