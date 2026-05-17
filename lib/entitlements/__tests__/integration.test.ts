/**
 * Integration tests — run against the real db/entitlements.sqlite.
 * Requires: npm run db:migrate && npm run db:seed
 * Run with: npm run test:integration
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { join } from 'path';
import { findEntitlementsAtAirport } from '../findEntitlementsAtAirport';
import { createAirlineRepository, createTierRepository } from '../../normalization/repository';
import { createAirportRepository } from '../repository';
import type { FlightRequest, UserInput } from '../types';

const DB_PATH = join(process.cwd(), 'db', 'entitlements.sqlite');

if (!existsSync(DB_PATH)) {
  console.error('✗ db/entitlements.sqlite not found — run: npm run db:migrate && npm run db:seed');
  process.exit(1);
}

const repos = {
  airlines: createAirlineRepository(),
  tiers:    createTierRepository(),
  airport:  createAirportRepository(),
};

// 10:00 — all lounges with "Daily 05:00–22:00" hours are open.
const OPEN  = new Date('2025-05-16T10:00:00');
// 03:30 — outside normal hours; JAL Sakura (09–15) also closed.
const EARLY = new Date('2025-05-16T03:30:00');

function find(lounges: ReturnType<typeof findEntitlementsAtAirport>['lounges'], name: string) {
  const l = lounges.find((e) => e.lounge.name === name);
  assert.ok(l, `Lounge "${name}" not found in results`);
  return l;
}

// ─── HEL ─────────────────────────────────────────────────────────────────────

describe('HEL', () => {
  test('AY Gold → Finnair Lounges allowed, Platinum Wing denied, fast track available', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'FRA' },
      repos, { now: OPEN },
    );

    assert.equal(r.status?.allianceTier, 'oneworld_sapphire');

    const platWing = find(r.lounges, 'Finnair Platinum Wing');
    assert.equal(platWing.access.status, 'denied', 'Platinum Wing vaatii emeraldin');

    const ns = find(r.lounges, 'Finnair Lounge');   // first match (Non-Schengen)
    assert.equal(ns.access.status, 'allowed');

    const allowed = r.lounges.filter((l) => l.access.status === 'allowed');
    assert.ok(allowed.length >= 2, 'Vähintään 2 loungea pitää olla allowed (SC + NS)');

    // Sort order: allowed ennen denied
    assert.equal(r.lounges[0].access.status, 'allowed');

    assert.equal(r.fastTrack.available, true);
    assert.ok(r.fastTrack.reason.includes('oneworld_sapphire'));
  });

  test('AY Platinum → Platinum Wing also allowed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Platinum' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'LHR' },
      repos, { now: OPEN },
    );

    assert.equal(r.status?.allianceTier, 'oneworld_emerald');
    const platWing = find(r.lounges, 'Finnair Platinum Wing');
    assert.equal(platWing.access.status, 'allowed');
    assert.ok(platWing.access.reason.includes('oneworld_emerald'));
  });

  test('AY Silver (ruby) → fast track denied (alle sapphire-minimi)', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Silver' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'FRA' },
      repos, { now: OPEN },
    );
    assert.equal(r.status?.allianceTier, 'oneworld_ruby');
    assert.equal(r.fastTrack.available, false, 'Ruby ei riitä HEL fast trackiin');
  });

  test('AY Platinum + LH Senator, flying LX (star_alliance) → valitaan star_gold', () => {
    // Kriittinen monikorttitesti: emerald on absoluuttisesti korkeampi
    // mutta star_gold on oikea lennon allianssia vastaava kortti.
    const r = findEntitlementsAtAirport(
      { statusCards: [
        { programCode: 'ay-plus',       tierName: 'Platinum' },  // oneworld_emerald
        { programCode: 'lh-miles-more', tierName: 'Senator'  },  // star_gold
      ]},
      { operatingCarrier: 'LX', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'ZRH' },
      repos, { now: OPEN },
    );

    assert.equal(r.status?.allianceTier, 'star_gold',       'star_gold, ei oneworld_emerald');
    assert.equal(r.status?.programCode,  'lh-miles-more',   'LH Senator on oikea ohjelma');

    // HEL:ssä on vain oneworld/independent loungeja — star_alliance ei saa yhtään
    const allowed = r.lounges.filter((l) => l.access.status === 'allowed');
    assert.equal(allowed.length, 0, 'Ei star_alliance loungeja HEL:ssä');
  });
});

// ─── FRA ─────────────────────────────────────────────────────────────────────

describe('FRA', () => {
  test('LH Senator + LX → molemmat Senator-loungit allowed, LH First allowed, fast track available', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'lh-miles-more', tierName: 'Senator' }] },
      { operatingCarrier: 'LX', cabin: 'economy', departureAirport: 'FRA', arrivalAirport: 'ZRH' },
      repos, { now: OPEN },
    );

    const senators = r.lounges.filter((l) => l.lounge.name === 'Lufthansa Senator Lounge');
    assert.equal(senators.length, 2, 'SC + non-SC Senator Lounge');
    senators.forEach((l) => assert.equal(l.access.status, 'allowed'));

    // LH First on airline_own [LH, LX, OS, SN] — LX on listalla
    const lhFirst = find(r.lounges, 'Lufthansa First Class Lounge');
    assert.equal(lhFirst.access.status, 'allowed', 'LX in [LH, LX, OS, SN] restriction');

    assert.equal(r.fastTrack.available, true);
  });

  test('AY Gold 10:30 → JAL Sakura ja Qatar Business allowed (molemmat auki)', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'FRA', arrivalAirport: 'HEL' },
      repos, { now: new Date('2025-05-16T10:30:00') },
    );

    const jal = find(r.lounges, 'Japan Airlines Sakura Lounge');
    assert.equal(jal.access.status, 'allowed', 'JAL Sakura auki 09–15, AY Gold = sapphire all_alliance');

    const qr = find(r.lounges, 'Qatar Airways Business Lounge');
    assert.equal(qr.access.status, 'allowed');
  });

  test('AY Gold 04:00 → JAL Sakura closed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'FRA', arrivalAirport: 'HEL' },
      repos, { now: EARLY },
    );
    const jal = find(r.lounges, 'Japan Airlines Sakura Lounge');
    assert.equal(jal.access.status, 'closed');
  });
});

// ─── LHR ─────────────────────────────────────────────────────────────────────

describe('LHR', () => {
  test('BA Gold + BA-lento → Concorde Room (emerald+BA) allowed, Galleries Club allowed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ba-exec-club', tierName: 'Gold' }] },
      { operatingCarrier: 'BA', cabin: 'economy', departureAirport: 'LHR', arrivalAirport: 'JFK' },
      repos, { now: OPEN },
    );

    assert.equal(r.status?.allianceTier, 'oneworld_emerald');
    find(r.lounges, 'British Airways Concorde Room').access.status === 'allowed'
      || assert.fail('Concorde Room pitää olla allowed (BA carrier + emerald)');
    find(r.lounges, 'British Airways Galleries Club Lounge').access.status === 'allowed'
      || assert.fail('Galleries Club pitää olla allowed');

    // Käytetään assert.equal jotta virheviesti on selkeä
    assert.equal(find(r.lounges, 'British Airways Concorde Room').access.status,       'allowed');
    assert.equal(find(r.lounges, 'British Airways Galleries Club Lounge').access.status, 'allowed');
  });

  test('AY Gold + BA-lento LHR → Concorde denied (BA/IB vain), Galleries allowed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'BA', cabin: 'economy', departureAirport: 'LHR', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );

    // Concorde: carrier_specific, restriction=['BA','IB']. Operating=BA → allowed!
    // Tämä on tärkeä: restriction = operating carrier, ei status-kortin carrier.
    assert.equal(find(r.lounges, 'British Airways Concorde Room').access.status,
      'denied',  // AY Gold on vain sapphire — emerald vaaditaan
    );
    assert.equal(find(r.lounges, 'British Airways Galleries Club Lounge').access.status, 'allowed');
  });

  test('AY Platinum + BA-lento LHR → Concorde denied (AY ei BA/IB), Galleries allowed', () => {
    // Vaikka AY Platinum on emerald, Concorde Room vaatii carrier BA tai IB
    // Mutta operating carrier on BA → restriction täyttyy!
    // Tämä testi varmistaa: restriction tarkistaa OPERATING CARRIERIN, ei statuskorttiyhtiötä.
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Platinum' }] },
      { operatingCarrier: 'BA', cabin: 'economy', departureAirport: 'LHR', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );

    // Operating carrier = BA, restriction ['BA','IB'] → täsmää → tarkistetaan tier
    // AY Platinum = emerald, vaatimus = emerald → allowed!
    assert.equal(find(r.lounges, 'British Airways Concorde Room').access.status, 'allowed',
      'Operating carrier BA täsmää restrictiooniin; AY Platinum = emerald OK');
  });
});

// ─── JFK ─────────────────────────────────────────────────────────────────────

describe('JFK', () => {
  test('AY Gold (sapphire) + IB-lento → Flagship denied (vaatii emeraldin), Admirals allowed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'IB', cabin: 'economy', departureAirport: 'JFK', arrivalAirport: 'MAD' },
      repos, { now: OPEN },
    );

    assert.equal(find(r.lounges, 'American Airlines Flagship Lounge').access.status,
      'denied', 'Flagship: all_alliance oneworld_emerald — sapphire ei riitä');
    assert.equal(find(r.lounges, 'American Airlines Admirals Club').access.status,
      'allowed', 'Admirals: all_alliance oneworld_sapphire — sapphire riittää');
  });

  test('BA Gold (emerald) + IB-lento → molemmat JFK loungit allowed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ba-exec-club', tierName: 'Gold' }] },
      { operatingCarrier: 'IB', cabin: 'economy', departureAirport: 'JFK', arrivalAirport: 'MAD' },
      repos, { now: OPEN },
    );

    assert.equal(find(r.lounges, 'American Airlines Flagship Lounge').access.status,
      'allowed', 'Flagship: all_alliance emerald — BA Gold = emerald OK');
    assert.equal(find(r.lounges, 'American Airlines Admirals Club').access.status,
      'allowed');
  });
});

// ─── DXB ─────────────────────────────────────────────────────────────────────

describe('DXB', () => {
  test('EK economy, ei statusta → Emirates loungit allowed (airline_own), fast track denied', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [] },
      { operatingCarrier: 'EK', cabin: 'economy', departureAirport: 'DXB', arrivalAirport: 'LHR' },
      repos, { now: OPEN },
    );

    assert.equal(r.status, null, 'Ei statuskorttia → status null');
    assert.equal(find(r.lounges, 'Emirates First Class Lounge').access.status,    'allowed');
    assert.equal(find(r.lounges, 'Emirates Business Class Lounge').access.status, 'allowed');
    assert.equal(r.fastTrack.available, false);
  });

  test('AY Gold + AY-lento DXB → Emirates loungit denied (ei EK-carrier)', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'DXB', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );

    // Operating carrier AY ≠ EK → airline_own EK restriction not met
    assert.equal(find(r.lounges, 'Emirates First Class Lounge').access.status,    'denied');
    assert.equal(find(r.lounges, 'Emirates Business Class Lounge').access.status, 'denied');
  });
});

// ─── Tuntematon kenttä ────────────────────────────────────────────────────────

describe('tuntematon kenttä', () => {
  test('XXX-kenttä → tyhjä lounge-lista', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'XXX', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );
    assert.equal(r.lounges.length, 0);
  });
});
