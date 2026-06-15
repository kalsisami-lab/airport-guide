/**
 * Phase 14: OP Lounge by Aspire (HEL, id=4).
 * Covers: PP/LK walk-in, oneworld Sapphire+ on oneworld carrier,
 *         carrier restriction (non-oneworld → no alliance access), paid walk-in.
 *
 * Note: "oneworld_sapphire on non-oneworld carrier" → paid_available (not denied),
 * because the lounge has a paid channel. The carrier restriction blocks the
 * alliance_status channel, but walk-in access still applies.
 *
 * OP cards: OP Visa Platinum carries Priority Pass → allowed via priority_pass.
 *           OP Mastercard World Elite carries LoungeKey → allowed via lounge_key.
 *           No separate op_card ChannelType exists in the engine.
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

// ─── OP Lounge by Aspire fixture (mirrors DB state after patch) ──────────────

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
      {
        id: 4, channelType: 'priority_pass', allianceAccess: null,
        rules: [{ id: 4, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.95, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
      {
        id: 5, channelType: 'lounge_key', allianceAccess: null,
        rules: [{ id: 5, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.95, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
      {
        id: 6, channelType: 'dragon_pass', allianceAccess: null,
        rules: [{ id: 6, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.95, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
      // oneworld Sapphire+ — all_alliance: engine checks passenger.operatingAlliance === 'oneworld'
      {
        id: 50, channelType: 'alliance_status', allianceAccess: 'all_alliance',
        rules: [{ id: 50, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.9, minAllianceTier: 'oneworld_sapphire',
          carrierRestriction: null,
          conditions: null }],
      },
      {
        id: 51, channelType: 'paid', allianceAccess: null,
        rules: [{ id: 51, priority: 100, validFrom: '2020-01-01', validTo: null,
          confidence: 0.9, minAllianceTier: null, carrierRestriction: null, conditions: null }],
      },
    ],
    exceptions: [],
  };
}

const repos: Repos = {
  airlines: airlineRepo,
  tiers:    tierRepo,
  airport:  makeAirportRepo([makeOPLounge()]),
};

const NOW    = new Date('2026-06-15T10:00:00');
const AY_HEL: FlightRequest = { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'LHR' };
const SK_HEL: FlightRequest = { operatingCarrier: 'SK', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'ARN' };

function getOP(result: ReturnType<typeof findEntitlementsAtAirport>) {
  const l = result.lounges.find((l) => l.lounge.name === 'OP Lounge by Aspire');
  assert.ok(l, 'OP Lounge by Aspire not found in result');
  return l;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OP Lounge by Aspire (HEL id=4)', () => {

  test('OP Visa Platinum (PP member) → allowed via priority_pass', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    const l = getOP(result);
    assert.equal(l.access.status, 'allowed');
    assert.ok(l.access.source?.startsWith('channel:'), 'source should be channel-based');
  });

  test('OP Mastercard World Elite (LoungeKey member) → allowed via lounge_key', () => {
    const user: UserInput = { statusCards: [], cards: ['lounge_key'] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getOP(result).access.status, 'allowed');
  });

  test('Finnair Plus Gold (oneworld_sapphire) + AY flight → allowed via alliance_status', () => {
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }], cards: [] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getOP(result).access.status, 'allowed');
  });

  test('oneworld_sapphire on non-oneworld carrier (SK) → paid_available (carrier restriction blocks alliance channel)', () => {
    // alliance_status channel: carrier_restriction excludes SK → no alliance match
    // paid channel still applies → best result is paid_available, not denied
    const user: UserInput = { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }], cards: [] };
    const result = findEntitlementsAtAirport(user, SK_HEL, repos, { now: NOW });
    assert.equal(getOP(result).access.status, 'paid_available');
  });

  test('PP holder on non-oneworld carrier → allowed via priority_pass (PP ignores carrier)', () => {
    const user: UserInput = { statusCards: [], cards: ['priority_pass'] };
    const result = findEntitlementsAtAirport(user, SK_HEL, repos, { now: NOW });
    assert.equal(getOP(result).access.status, 'allowed');
  });

  test('walk-in (no card, no status) → paid_available', () => {
    const user: UserInput = { statusCards: [], cards: [] };
    const result = findEntitlementsAtAirport(user, AY_HEL, repos, { now: NOW });
    assert.equal(getOP(result).access.status, 'paid_available');
  });
});
