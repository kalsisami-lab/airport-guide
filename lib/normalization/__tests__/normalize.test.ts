import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPassengerContext, buildStatusContext } from '../normalize';
import type {
  AirlineRepository,
  AllianceCode,
  AllianceTier,
  TierRepository,
  UserStatusCard,
} from '../types';

// ─── Static mock repositories (no DB required) ────────────────────────────────

const CARRIER_ALLIANCE: Record<string, AllianceCode> = {
  AY: 'oneworld',      BA: 'oneworld',      IB: 'oneworld',
  QR: 'oneworld',      JL: 'oneworld',      AA: 'oneworld',
  LH: 'star_alliance', LX: 'star_alliance', TK: 'star_alliance',
  UA: 'star_alliance', NH: 'star_alliance',
  AF: 'skyteam',       KL: 'skyteam',       DL: 'skyteam',
  EK: null,            B6: null,            U2: null,
};

const airlineRepo: AirlineRepository = {
  getAllianceForCarrier: (code) => CARRIER_ALLIANCE[code] ?? null,
};

type TierEntry = { allianceTier: AllianceTier; fastTrack: boolean };
const TIER_MAP: Record<string, TierEntry> = {
  'ay-plus:Gold':           { allianceTier: 'oneworld_sapphire',  fastTrack: true  },
  'ay-plus:Platinum':       { allianceTier: 'oneworld_emerald',   fastTrack: true  },
  'ba-exec-club:Silver':    { allianceTier: 'oneworld_sapphire',  fastTrack: true  },
  'ba-exec-club:Gold':      { allianceTier: 'oneworld_emerald',   fastTrack: true  },
  'lh-miles-more:Senator':  { allianceTier: 'star_gold',          fastTrack: true  },
  'ua-mileageplus:Gold':    { allianceTier: 'star_gold',          fastTrack: true  },
  'dl-skymiles:Gold':       { allianceTier: 'skyteam_elite_plus', fastTrack: true  },
  'ek-skywards:Silver':     { allianceTier: 'none',               fastTrack: false },
  'ek-skywards:Gold':       { allianceTier: 'none',               fastTrack: false },
};

const tierRepo: TierRepository = {
  getTierForCard: (prog, tier) => TIER_MAP[`${prog}:${tier}`] ?? null,
};

// ─── buildPassengerContext ────────────────────────────────────────────────────

describe('buildPassengerContext', () => {
  test('resolves oneworld alliance for AY', () => {
    const ctx = buildPassengerContext(
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'FRA' },
      airlineRepo,
    );
    assert.equal(ctx.operatingAlliance, 'oneworld');
  });

  test('resolves star_alliance for UA', () => {
    const ctx = buildPassengerContext(
      { operatingCarrier: 'UA', cabin: 'business', departureAirport: 'JFK', arrivalAirport: 'LHR' },
      airlineRepo,
    );
    assert.equal(ctx.operatingAlliance, 'star_alliance');
  });

  test('operatingAlliance is null for independent carrier EK', () => {
    const ctx = buildPassengerContext(
      { operatingCarrier: 'EK', cabin: 'economy', departureAirport: 'DXB', arrivalAirport: 'LHR' },
      airlineRepo,
    );
    assert.equal(ctx.operatingAlliance, null);
  });

  test('marketingCarrier defaults to operatingCarrier', () => {
    const ctx = buildPassengerContext(
      { operatingCarrier: 'BA', cabin: 'business', departureAirport: 'LHR', arrivalAirport: 'JFK' },
      airlineRepo,
    );
    assert.equal(ctx.marketingCarrier, 'BA');
  });

  test('uses explicit marketingCarrier when provided', () => {
    const ctx = buildPassengerContext(
      { operatingCarrier: 'AY', marketingCarrier: 'BA', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'LHR' },
      airlineRepo,
    );
    assert.equal(ctx.operatingCarrier, 'AY');
    assert.equal(ctx.marketingCarrier, 'BA');
    // Alliance based on OPERATING carrier
    assert.equal(ctx.operatingAlliance, 'oneworld');
  });

  test('sameDayDeparture defaults to false', () => {
    const ctx = buildPassengerContext(
      { operatingCarrier: 'LH', cabin: 'economy', departureAirport: 'FRA', arrivalAirport: 'MUC' },
      airlineRepo,
    );
    assert.equal(ctx.sameDayDeparture, false);
  });

  test('passes sameDayDeparture through when provided', () => {
    const ctx = buildPassengerContext(
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'TLL', sameDayDeparture: true },
      airlineRepo,
    );
    assert.equal(ctx.sameDayDeparture, true);
  });
});

// ─── buildStatusContext ───────────────────────────────────────────────────────

describe('buildStatusContext', () => {
  // Speksin skenaariot:

  test('ei korttia → null', () => {
    const result = buildStatusContext([], 'oneworld', tierRepo);
    assert.equal(result, null);
  });

  test('AY Gold + BA-lento → oneworld_sapphire', () => {
    const cards: UserStatusCard[] = [{ programCode: 'ay-plus', tierName: 'Gold' }];
    const result = buildStatusContext(cards, 'oneworld', tierRepo);
    assert.ok(result !== null);
    assert.equal(result.allianceTier, 'oneworld_sapphire');
    assert.equal(result.programCode, 'ay-plus');
    assert.equal(result.fastTrack, true);
  });

  test('LH Senator + UA-lento → star_gold', () => {
    const cards: UserStatusCard[] = [{ programCode: 'lh-miles-more', tierName: 'Senator' }];
    const result = buildStatusContext(cards, 'star_alliance', tierRepo);
    assert.ok(result !== null);
    assert.equal(result.allianceTier, 'star_gold');
    assert.equal(result.programCode, 'lh-miles-more');
  });

  test('EK Skywards + AY-lento → none (EK:llä ei alianssia)', () => {
    const cards: UserStatusCard[] = [{ programCode: 'ek-skywards', tierName: 'Gold' }];
    const result = buildStatusContext(cards, 'oneworld', tierRepo);
    assert.ok(result !== null);
    assert.equal(result.allianceTier, 'none');
    assert.equal(result.programCode, 'ek-skywards');
  });

  test('useita kortteja: AY Gold + EK Gold BA-lennolla → AY voittaa (allianssi täsmää)', () => {
    const cards: UserStatusCard[] = [
      { programCode: 'ek-skywards', tierName: 'Gold' },
      { programCode: 'ay-plus',     tierName: 'Gold' },
    ];
    const result = buildStatusContext(cards, 'oneworld', tierRepo);
    assert.ok(result !== null);
    assert.equal(result.allianceTier, 'oneworld_sapphire');
    assert.equal(result.programCode, 'ay-plus');
  });

  test('useita kortteja: valitaan korkein tier saman allianssin sisällä', () => {
    const cards: UserStatusCard[] = [
      { programCode: 'ay-plus',      tierName: 'Gold' },  // sapphire
      { programCode: 'ba-exec-club', tierName: 'Gold' },  // emerald
    ];
    const result = buildStatusContext(cards, 'oneworld', tierRepo);
    assert.ok(result !== null);
    assert.equal(result.allianceTier, 'oneworld_emerald');
    assert.equal(result.programCode, 'ba-exec-club');
  });

  test('useita kortteja: vain EK SkyTeam-lennolla → palautetaan none (ei täsmäävää korttia)', () => {
    const cards: UserStatusCard[] = [{ programCode: 'ek-skywards', tierName: 'Silver' }];
    const result = buildStatusContext(cards, 'skyteam', tierRepo);
    assert.ok(result !== null);
    assert.equal(result.allianceTier, 'none');
  });

  test('tuntematon ohjelmakoodi → null', () => {
    const cards: UserStatusCard[] = [{ programCode: 'mystery-ffp', tierName: 'Elite' }];
    const result = buildStatusContext(cards, 'oneworld', tierRepo);
    assert.equal(result, null);
  });

  test('AY Platinum (emerald) + LH Senator (star_gold) + SAS-lento → star_gold, ei emerald', () => {
    // Kriittinen tapaus: korkein absoluuttinen tier (emerald) on väärä valinta
    // kun lennon allianssi on star_alliance. Oikea on star_gold.
    const cards: UserStatusCard[] = [
      { programCode: 'ay-plus',       tierName: 'Platinum' },  // oneworld_emerald
      { programCode: 'lh-miles-more', tierName: 'Senator'  },  // star_gold
    ];
    // SK = SAS = star_alliance
    const result = buildStatusContext(cards, 'star_alliance', tierRepo);
    assert.ok(result !== null);
    assert.equal(result.allianceTier, 'star_gold',        'Pitää valita star_gold, ei oneworld_emerald');
    assert.equal(result.programCode,  'lh-miles-more',    'LH Senator on lennon allianssin kortti');
  });

  test('flightAlliance null (itsenäinen lentoyhtiö) → palautetaan paras käytettävissä oleva kortti', () => {
    const cards: UserStatusCard[] = [{ programCode: 'ay-plus', tierName: 'Platinum' }];
    const result = buildStatusContext(cards, null, tierRepo);
    assert.ok(result !== null);
    assert.equal(result.allianceTier, 'oneworld_emerald');
  });
});
