/**
 * Phase 16: Plaza Premium Lounge (HEL, id=27, non-Schengen).
 *
 * Verifies:
 *   - PP / LK / DP / op_card / paid channels grant access at conf 0.9 → `allowed`
 *   - Non-Schengen lounge is `physically_unreachable` on Schengen flights
 *   - AY Finnair Plus Gold does NOT get access (guard against accidental alliance rule)
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
  BA: 'oneworld',
  LH: 'star_alliance',
};

const airlineRepo: AirlineRepository = {
  getAllianceForCarrier: (code) => CARRIER_ALLIANCE[code] ?? null,
};

const tierRepo: TierRepository = {
  getTierForCard: (prog, tier) => {
    if (prog === 'ay-plus' && tier === 'Gold')     return { allianceTier: 'oneworld_sapphire', fastTrack: true };
    if (prog === 'ay-plus' && tier === 'Platinum') return { allianceTier: 'oneworld_emerald',  fastTrack: true };
    return null;
  },
};

const AIRPORT_COUNTRY: Record<string, string> = {
  HEL: 'FI',
  FRA: 'DE',   // Schengen
  LHR: 'GB',   // non-Schengen (Brexit)
  JFK: 'US',   // non-Schengen
};

function makeAirportRepo(lounges: LoungeInputWithMeta[]): AirportRepository {
  return {
    getLoungesAtAirport: (iata) => (iata === 'HEL' ? lounges : []),
    getAirportServiceRules: () => [],
    getAirportInfo: (iata): AirportInfo | null => {
      const cc = AIRPORT_COUNTRY[iata];
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

// ─── Fixture: mirrors DB state after patch-hel-plaza-premium.ts ─────────────

function makePlazaPremium(): LoungeInputWithMeta {
  const RULE_BASE = {
    priority:           100,
    validFrom:          '2020-01-01',
    validTo:            null,
    confidence:         0.9,
    minAllianceTier:    null,
    carrierRestriction: null,
    conditions:         null,
  } as const;

  return {
    id:                  27,
    name:                'Plaza Premium Lounge',
    terminalId:          null,
    openingHours:        'Daily 06:00–00:00',
    tier:                'standard',
    loungeClass:         'standard',
    area:                'non_schengen',
    locationDescription: 'Non-Schengen, Mezzanine Level — near Gate 40',
    amenities:           ['Buffet', 'Bar', 'Shower', 'GoSleep pods', 'WiFi', 'Workspace', 'Kids area'],
    channels: [
      { id: 54, channelType: 'priority_pass', allianceAccess: null, rules: [{ id: 54, ...RULE_BASE }] },
      { id: 55, channelType: 'lounge_key',    allianceAccess: null, rules: [{ id: 55, ...RULE_BASE }] },
      { id: 56, channelType: 'dragon_pass',   allianceAccess: null, rules: [{ id: 56, ...RULE_BASE }] },
      { id: 57, channelType: 'op_card',       allianceAccess: null, rules: [{ id: 57, ...RULE_BASE }] },
      { id: 58, channelType: 'paid',          allianceAccess: null, rules: [{ id: 58, ...RULE_BASE }] },
    ],
    exceptions: [],
  };
}

const repos: Repos = {
  airlines: airlineRepo,
  tiers:    tierRepo,
  airport:  makeAirportRepo([makePlazaPremium()]),
};

// Use a time within opening hours (06:00–00:00) to avoid the `closed` early return
const NOW = new Date('2026-06-15T12:00:00');

const HEL_LHR: FlightRequest = { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'LHR' };
const HEL_JFK: FlightRequest = { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'JFK' };
const HEL_FRA: FlightRequest = { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'FRA' };

function getLounge(result: ReturnType<typeof findEntitlementsAtAirport>) {
  const l = result.lounges.find((l) => l.lounge.name === 'Plaza Premium Lounge');
  assert.ok(l, 'Plaza Premium Lounge not found in result');
  return l;
}

// ─── Card-based access on non-Schengen flights ──────────────────────────────

describe('Plaza Premium HEL — card access on non-Schengen flights', () => {

  test('Priority Pass + HEL→LHR → allowed', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const l = getLounge(findEntitlementsAtAirport(user, HEL_LHR, repos, { now: NOW }));
    assert.equal(l.access.status, 'allowed');
    assert.equal(l.access.accessVia, 'Priority Pass');
  });

  test('LoungeKey + HEL→JFK → allowed (conf 0.9)', () => {
    const user: UserInput = { statusCards: [], cards: ['lounge_key'] };
    const l = getLounge(findEntitlementsAtAirport(user, HEL_JFK, repos, { now: NOW }));
    assert.equal(l.access.status, 'allowed');
    assert.equal(l.access.accessVia, 'LoungeKey');
  });

  test('DragonPass + HEL→LHR → allowed', () => {
    const user: UserInput = { statusCards: [], cards: ['dragon_pass'] };
    const l = getLounge(findEntitlementsAtAirport(user, HEL_LHR, repos, { now: NOW }));
    assert.equal(l.access.status, 'allowed');
    assert.equal(l.access.accessVia, 'DragonPass');
  });

  test('OP Visa Platinum (op_card + PP) + HEL→LHR → allowed', () => {
    const user: UserInput = { statusCards: [], cards: ['op_card', 'priority_pass'] };
    const l = getLounge(findEntitlementsAtAirport(user, HEL_LHR, repos, { now: NOW }));
    assert.equal(l.access.status, 'allowed');
  });

  test('walk-in (no cards, no status) + HEL→LHR → paid_available', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const l = getLounge(findEntitlementsAtAirport(user, HEL_LHR, repos, { now: NOW }));
    assert.equal(l.access.status, 'paid_available');
  });
});

// ─── Schengen zone gating ────────────────────────────────────────────────────

describe('Plaza Premium HEL — Schengen zone check', () => {

  test('PP + HEL→FRA (Schengen) → physically_unreachable', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const l = getLounge(findEntitlementsAtAirport(user, HEL_FRA, repos, { now: NOW }));
    assert.equal(l.access.status, 'physically_unreachable');
    assert.equal(l.access.source, 'schengen_zone_check');
  });

  test('walk-in + HEL→FRA (Schengen) → physically_unreachable (zone blocks before paid fallback)', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const l = getLounge(findEntitlementsAtAirport(user, HEL_FRA, repos, { now: NOW }));
    assert.equal(l.access.status, 'physically_unreachable');
  });
});

// ─── Guard: no alliance channel accidentally granted ─────────────────────────

describe('Plaza Premium HEL — no alliance access channel', () => {

  test('AY Finnair Plus Gold + HEL→LHR → paid_available (no alliance rule)', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }], cards: [] };
    const l = getLounge(findEntitlementsAtAirport(user, HEL_LHR, repos, { now: NOW }));
    assert.equal(l.access.status, 'paid_available');
  });
});
