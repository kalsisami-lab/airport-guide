/**
 * Phase 14 (fix): OP Lounge by Aspire (HEL, id=4).
 *
 * Access model after fix:
 *   - op_card channel:         OP Visa Gold / Platinum / Mastercard World Elite
 *   - alliance_status channel: oneworld Sapphire+ flying on oneworld carrier
 *   - paid channel:            walk-in
 *
 * NOT accepted (channels removed in fix):
 *   - priority_pass, lounge_key, dragon_pass — these apply to Aspire Gate 13/27,
 *     not to the OP-branded lounge. Operator brand ≠ access channels.
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
  SK: 'star_alliance',
};

const airlineRepo: AirlineRepository = {
  getAllianceForCarrier: (code) => CARRIER_ALLIANCE[code] ?? null,
};

const tierRepo: TierRepository = {
  getTierForCard: (prog, tier) => {
    if (prog === 'ay-plus' && tier === 'Gold') return { allianceTier: 'oneworld_sapphire', fastTrack: true };
    return null;
  },
};

function makeAirportRepo(lounges: LoungeInputWithMeta[]): AirportRepository {
  return {
    getLoungesAtAirport: (iata) => (iata === 'HEL' ? lounges : []),
    getAirportServiceRules: () => [],
    getAirportInfo: (iata): AirportInfo | null =>
      iata === 'HEL' ? { countryCode: 'FI', isSchengen: isSchengenCountry('FI') } : null,
  };
}

// ─── OP Lounge by Aspire fixture (mirrors DB state after fix) ─────────────────

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
      // oneworld Sapphire+ — all_alliance dynamic lookup
      {
        id: 50, channelType: 'alliance_status', allianceAccess: 'all_alliance',
        rules: [{ id: 50, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.9, minAllianceTier: 'oneworld_sapphire',
          carrierRestriction: null, conditions: null }],
      },
      // Walk-in paid
      {
        id: 51, channelType: 'paid', allianceAccess: null,
        rules: [{ id: 51, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.9, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
      // OP card (bank-branded access — no PP/LK/DP here)
      {
        id: 52, channelType: 'op_card', allianceAccess: null,
        rules: [{ id: 52, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.9, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
    ],
    exceptions: [],
  };
}

// Separate Aspire lounge (Gate 27) — has PP, unlike OP Lounge
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
const AY_HEL: FlightRequest = { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'LHR' };
const SK_HEL: FlightRequest = { operatingCarrier: 'SK', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'ARN' };

function getLounge(result: ReturnType<typeof findEntitlementsAtAirport>, name: string) {
  const l = result.lounges.find((l) => l.lounge.name === name);
  assert.ok(l, `Lounge "${name}" not found in result`);
  return l;
}

// ─── OP Lounge: op_card access ───────────────────────────────────────────────

describe('OP Lounge by Aspire — op_card channel', () => {

  test('OP Visa Gold (op-card only) → allowed via op_card', () => {
    const user: UserInput = { statusCards: [], cards: ['op_card'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    const l = getLounge(result, 'OP Lounge by Aspire');
    assert.equal(l.access.status, 'allowed');
    assert.ok(l.access.source?.startsWith('channel:'), 'source should be channel-based');
  });

  test('OP Visa Platinum (PP + op-card) → allowed via op_card at OP Lounge', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass', 'op_card'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'allowed');
  });

  test('OP Mastercard World Elite (LK + op-card) → allowed via op_card at OP Lounge', () => {
    const user: UserInput = { statusCards: [], cards: ['lounge_key', 'op_card'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'allowed');
  });
});

// ─── OP Lounge: PP no longer grants access ────────────────────────────────────

describe('OP Lounge by Aspire — PP/LK channels removed', () => {

  test('Standalone PP card → paid_available at OP Lounge (no PP channel)', () => {
    // PP doesn't unlock OP Lounge; paid channel still makes it paid_available
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'paid_available');
  });

  test('PP card → likely_allowed at Aspire Gate 27 (PP channel intact, confidence 0.8)', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    // confidence 0.8 → likely_allowed (threshold is 0.85 for 'allowed')
    assert.equal(getLounge(result, 'Aspire Lounge by Gate 27').access.status, 'likely_allowed');
  });
});

// ─── OP Lounge: oneworld and walk-in ─────────────────────────────────────────

describe('OP Lounge by Aspire — alliance_status and paid', () => {

  test('Finnair Plus Gold (oneworld_sapphire) + AY → allowed via alliance_status', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }], cards: [] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'allowed');
  });

  test('oneworld_sapphire on non-oneworld carrier (SK) → paid_available (carrier mismatch)', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }], cards: [] };
    const result = findEntitlementsAtAirport(user, SK_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'paid_available');
  });

  test('walk-in (no card, no status) → paid_available', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getLounge(result, 'OP Lounge by Aspire').access.status, 'paid_available');
  });
});
