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

    // Platinum Wing on non-Schengen-puolella; HEL→FRA on Schengen-lento → ei fyysisesti saavutettavissa
    const platWing = find(r.lounges, 'Finnair Platinum Wing');
    assert.equal(platWing.access.status, 'physically_unreachable', 'Platinum Wing non-Schengen — Schengen-lento ei pääse sinne');

    // Schengen-puolen Finnair Lounge löytyy ensin sort-järjestyksessä (allowed ennen physically_unreachable)
    const ns = find(r.lounges, 'Finnair Lounge');
    assert.equal(ns.access.status, 'allowed');

    const allowed = r.lounges.filter((l) => l.access.status === 'allowed');
    assert.ok(allowed.length >= 1, 'Vähintään 1 lounge allowed (Schengen Finnair Lounge)');

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

  test('AY Silver (ruby) + AY flight → fast track allowed (Phase 15: AY-spesifinen ruby-sääntö)', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Silver' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'FRA' },
      repos, { now: OPEN },
    );
    assert.equal(r.status?.allianceTier, 'oneworld_ruby');
    assert.equal(r.fastTrack.available, true, 'AY Silver saa HEL Fast Trackin (Phase 15)');
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
  test('LH Senator + LX economy FRA→JFK → non-Schengen Senator allowed, Schengen Senator physically_unreachable, LH First denied (cabin=first), fast track available', () => {
    // Phase 20 update: arrival changed FRA→ZRH → FRA→JFK. ZRH is now seeded (CH
    // → Schengen), so the original ZRH arrival made this a Schengen flight and
    // the non-Schengen Senator lounge became correctly zone-blocked — which then
    // short-circuited the LH FCL cabin=first check (Phase 13's actual target).
    // Using JFK (non-Schengen) keeps both non-Schengen lounges reachable and
    // preserves the Phase 13 cabin=first regression check on LH FCL.
    // (Pre-Phase-20, ZRH was not in the airports table → arrivalIsSchengen fell
    // through to null → engine bypassed the zone check → both Senators appeared
    // allowed. Same latent bug class as Phase 17.)
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'lh-miles-more', tierName: 'Senator' }] },
      { operatingCarrier: 'LX', cabin: 'economy', departureAirport: 'FRA', arrivalAirport: 'JFK' },
      repos, { now: OPEN },
    );

    const senators = r.lounges.filter((l) => l.lounge.name === 'Lufthansa Senator Lounge');
    assert.equal(senators.length, 2, 'SC + non-SC Senator Lounge');
    const senatorSC  = senators.find((l) => l.lounge.area === 'schengen')!;
    const senatorNSC = senators.find((l) => l.lounge.area === 'non_schengen')!;
    assert.equal(senatorNSC.access.status, 'allowed',                'non-Schengen Senator reachable on FRA→JFK');
    assert.equal(senatorSC.access.status,  'physically_unreachable', 'Schengen Senator blocked on non-Schengen flight');

    // Phase 13 fix: FCL requires cabin=first — Senator economy no longer grants access
    const lhFirst = find(r.lounges, 'Lufthansa First Class Lounge');
    assert.equal(lhFirst.access.status, 'denied', 'Senator economy denied FCL — conditions require cabin=first');

    assert.equal(r.fastTrack.available, true);
  });

  test('AY Gold 10:30 FRA→JFK (non-Schengen) → Priority Lounge T2/T3 allowed (§36 AY on carrier list)', () => {
    // FRA→JFK: non-Schengen destination → non-Schengen T2 Priority Lounge reachable.
    // Post-Phase 34: JAL Sakura and Qatar Business Lounge deleted as demo data;
    // Priority Lounge (T2/T3) are the real oneworld lounges here.
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'FRA', arrivalAirport: 'JFK' },
      repos, { now: new Date('2025-05-16T10:30:00') },
    );

    const priorityT2 = find(r.lounges, 'Priority Lounge (T2)');
    assert.equal(priorityT2.access.status, 'allowed', 'Priority Lounge T2 auki 06:30–19:30, §36 [QR,AY]');

    const priorityT3 = find(r.lounges, 'Priority Lounge (T3)');
    assert.equal(priorityT3.access.status, 'allowed', 'Priority Lounge T3 auki 06:00–21:00, §36 [AA,BA,CX,JL,AY]');
  });

  test('AY Gold 10:30 FRA→HEL (Schengen) → non-Schengen loungit physically_unreachable', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'FRA', arrivalAirport: 'HEL' },
      repos, { now: new Date('2025-05-16T10:30:00') },
    );

    const priorityT2 = find(r.lounges, 'Priority Lounge (T2)');
    assert.equal(priorityT2.access.status, 'physically_unreachable', 'Priority T2 non-Schengen — Schengen-lento ei pääse');

    const priorityT3 = find(r.lounges, 'Priority Lounge (T3)');
    assert.equal(priorityT3.access.status, 'physically_unreachable');

    const afklm = find(r.lounges, 'Air France/KLM Lounge');
    assert.equal(afklm.access.status, 'physically_unreachable');
  });

  test('AY Gold 04:00 → Priority Lounge T2 closed (hours 06:30–19:30)', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'FRA', arrivalAirport: 'JFK' },
      repos, { now: EARLY },
    );
    const priorityT2 = find(r.lounges, 'Priority Lounge (T2)');
    assert.equal(priorityT2.access.status, 'closed');
  });
});

// ─── LHR ─────────────────────────────────────────────────────────────────────

describe('LHR', () => {
  // Concorde Room: airline_own [BA,IB] + conditions cabin='first'. No status gate.
  // Källa: käyttäjän ensikäden kokemus 2026 — oneworld Emerald + BA Business = denied,
  // vaatii First-lipun. (patch-lhr-concorde-room-cabin-fix.ts)

  test('BA Gold + BA-lento + Economy → Concorde Room denied (cabin gate — First required), Galleries Club allowed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ba-exec-club', tierName: 'Gold' }] },
      { operatingCarrier: 'BA', cabin: 'economy', departureAirport: 'LHR', arrivalAirport: 'JFK' },
      repos, { now: OPEN },
    );

    assert.equal(r.status?.allianceTier, 'oneworld_emerald');
    // Emerald status alone no longer opens Concorde Room in economy/business
    assert.notEqual(find(r.lounges, 'British Airways Concorde Room').access.status, 'allowed',
      'Concorde Room ei saa olla allowed pelkällä emerald-statuksella ilman First-lippua');
    // Galleries Club stays all_alliance oneworld_sapphire → Emerald qualifies
    assert.equal(find(r.lounges, 'BA Galleries North Club').access.status, 'allowed');
  });

  test('BA Gold + BA-lento + First → Concorde Room allowed (cabin gate satisfied)', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ba-exec-club', tierName: 'Gold' }] },
      { operatingCarrier: 'BA', cabin: 'first', departureAirport: 'LHR', arrivalAirport: 'JFK' },
      repos, { now: OPEN },
    );

    assert.equal(find(r.lounges, 'British Airways Concorde Room').access.status, 'allowed',
      'BA First-lipulla Concorde Room aukeaa (status ei enää portteri)');
    assert.equal(find(r.lounges, 'BA Galleries North Club').access.status, 'allowed');
  });

  test('AY Platinum + BA-lento + Business → Concorde Room denied (user field report: emerald+Business ≠ pääsy)', () => {
    // Käyttäjän vahvistama tapaus: oneworld Emerald + BA Business = ei pääsy.
    // Aiemmin väärin tässä testissä: 'allowed'. Nyt cabin=first vaaditaan.
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Platinum' }] },
      { operatingCarrier: 'BA', cabin: 'business', departureAirport: 'LHR', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );

    assert.notEqual(find(r.lounges, 'British Airways Concorde Room').access.status, 'allowed',
      'Concorde Room ei saa olla allowed emerald + Business -yhdistelmällä');
    // Galleries Club (all_alliance oneworld_sapphire) toimii
    assert.equal(find(r.lounges, 'BA Galleries North Club').access.status, 'allowed');
  });

  test('AY Platinum + AY-lento + First → Concorde Room NOT allowed (carrier gate — AY ei BA/IB)', () => {
    // Regressiotesti: vaikka First-lippu ja emerald, Concorde Room on vain BA/IB-operoidut.
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Platinum' }] },
      { operatingCarrier: 'AY', cabin: 'first', departureAirport: 'LHR', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );

    assert.notEqual(find(r.lounges, 'British Airways Concorde Room').access.status, 'allowed',
      'AY-operoidulla lennolla Concorde Room ei aukea vaikka olisi First');
  });
});

// ─── JFK ─────────────────────────────────────────────────────────────────────

describe('JFK', () => {
  // Phase 35: AA Flagship Lounge deleted (T8 consolidation split it into
  // Chelsea/Greenwich/Soho). Test scenarios rewritten to cover the new lounges.

  test('AY Gold (sapphire) + IB Economy JFK→MAD → Greenwich allowed, Soho denied (emerald), Chelsea denied (cabin), Admirals allowed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'IB', cabin: 'economy', departureAirport: 'JFK', arrivalAirport: 'MAD' },
      repos, { now: OPEN },
    );

    assert.equal(find(r.lounges, 'BA/AA Greenwich Lounge').access.status,
      'allowed', 'Greenwich: Ryhmä 1 sapphire, IB on 9-carrier list');
    assert.notEqual(find(r.lounges, 'BA/AA Soho Lounge').access.status,
      'allowed', 'Soho: Ryhmä 1 emerald — sapphire ei riitä');
    assert.notEqual(find(r.lounges, 'BA/AA Chelsea Lounge').access.status,
      'allowed', 'Chelsea: airline_own [AA,BA] + cabin=first — IB carrier + Economy = ei pääsy');
    assert.equal(find(r.lounges, 'American Airlines Admirals Club').access.status,
      'allowed', 'Admirals: all_alliance oneworld_sapphire — sapphire riittää');
  });

  test('BA Gold (emerald) + IB Economy JFK→MAD → Greenwich + Soho + Admirals allowed, Chelsea denied (cabin gate — emerald ei korvaa First-vaatimusta)', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ba-exec-club', tierName: 'Gold' }] },
      { operatingCarrier: 'IB', cabin: 'economy', departureAirport: 'JFK', arrivalAirport: 'MAD' },
      repos, { now: OPEN },
    );

    assert.equal(find(r.lounges, 'BA/AA Greenwich Lounge').access.status,
      'allowed', 'Greenwich sapphire — emerald riittää');
    assert.equal(find(r.lounges, 'BA/AA Soho Lounge').access.status,
      'allowed', 'Soho emerald — §52 OR-model, emerald yksin riittää');
    assert.equal(find(r.lounges, 'American Airlines Admirals Club').access.status,
      'allowed');
    assert.notEqual(find(r.lounges, 'BA/AA Chelsea Lounge').access.status,
      'allowed', 'Chelsea: §52 AND-tyyppi — First-lippu vaadittu (§62 field-verified)');
  });
});

// ─── DXB ─────────────────────────────────────────────────────────────────────

describe('DXB', () => {
  // Phase 35: Emirates lounges renamed (dropped "Class"). Added Ryhmä 1 [QF,AY]
  // channels alongside existing airline_own [EK] channels. EK's own pax still
  // access via airline_own; QF+AY now access via oneworld carrier_specific.

  test('EK economy, ei statusta → Emirates loungit allowed (airline_own EK), fast track denied', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [] },
      { operatingCarrier: 'EK', cabin: 'economy', departureAirport: 'DXB', arrivalAirport: 'LHR' },
      repos, { now: OPEN },
    );

    assert.equal(r.status, null, 'Ei statuskorttia → status null');
    assert.equal(find(r.lounges, 'Emirates First Lounge').access.status,    'allowed');
    assert.equal(find(r.lounges, 'Emirates Business Lounge').access.status, 'allowed');
    assert.equal(r.fastTrack.available, false);
  });

  test('AY Gold (sapphire) + AY-lento DXB → Business allowed (Ryhmä 1 sapphire), First denied (emerald floor)', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'DXB', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );

    // AY now on carrier_specific [QF,AY] list. Sapphire enough for Business, not First (emerald).
    assert.equal(find(r.lounges, 'Emirates Business Lounge').access.status, 'allowed',
      'Emirates Business — Ryhmä 1 sapphire, AY on carrier list');
    assert.notEqual(find(r.lounges, 'Emirates First Lounge').access.status, 'allowed',
      'Emirates First — Ryhmä 1 emerald, sapphire ei riitä');
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

// ─── API contract tests (Vaihe 10) ───────────────────────────────────────────
// These verify the shape of data that Dashboard → /api/entitlements returns.

describe('API contract: HEL + AY Gold', () => {
  test('HEL Finnair Lounge on allowed, neljä palvelua tuloksessa', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'FRA' },
      repos, { now: OPEN },
    );

    const finAir = r.lounges.find((l) => l.lounge.name === 'Finnair Lounge');
    assert.ok(finAir, 'Finnair Lounge löytyy listalta');
    assert.equal(finAir!.access.status, 'allowed', 'Finnair Lounge on allowed AY Gold:lla');
    assert.ok(typeof finAir!.access.reason === 'string' && finAir!.access.reason.length > 0, 'reason ei ole tyhjä');
    assert.ok(finAir!.access.confidence >= 0 && finAir!.access.confidence <= 1, 'confidence välillä 0–1');

    // Neljä palvelua
    const svcKeys = Object.keys(r.services);
    assert.ok(svcKeys.includes('fast_track_security'),  'fast_track_security');
    assert.ok(svcKeys.includes('priority_checkin'),     'priority_checkin');
    assert.ok(svcKeys.includes('priority_boarding'),    'priority_boarding');
    assert.ok(svcKeys.includes('priority_baggage'),     'priority_baggage');

    // Fast track AY Gold HEL:ssä on allowed
    assert.equal(r.services.fast_track_security.status, 'allowed', 'fast track allowed AY Gold HEL');
  });
});

describe('API contract: JFK ilman statusta', () => {
  test('JFK ilman statusta → ei allowed-loungeja, kaikki denied tai paid', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [] },
      { operatingCarrier: 'UNKN', cabin: 'economy', departureAirport: 'JFK', arrivalAirport: 'LHR' },
      repos, { now: OPEN },
    );

    const allowed = r.lounges.filter(
      (l) => l.access.status === 'allowed' || l.access.status === 'likely_allowed',
    );
    assert.equal(allowed.length, 0, 'Ei allowed-loungeja ilman statusta JFK:ssa');

    // AirportEntitlements-rakenne on ehjä
    assert.ok(Array.isArray(r.lounges),        'lounges on array');
    assert.ok(typeof r.services === 'object',  'services on objekti');
    assert.ok(typeof r.evaluatedAt === 'string', 'evaluatedAt on string');
  });
});

describe('API contract: HEL + AY Gold → kaikki neljä palvelua', () => {
  test('kaikki neljä palvelua löytyvät ja jokaisella on AccessResult-rakenne', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'HEL', arrivalAirport: 'FRA' },
      repos, { now: OPEN },
    );

    const serviceTypes = ['fast_track_security', 'priority_checkin', 'priority_boarding', 'priority_baggage'] as const;
    for (const svc of serviceTypes) {
      const result = r.services[svc];
      assert.ok(result, `${svc} löytyy`);
      assert.ok(typeof result.status === 'string',     `${svc}.status on string`);
      assert.ok(typeof result.confidence === 'number', `${svc}.confidence on number`);
      assert.ok(typeof result.reason === 'string',     `${svc}.reason on string`);
    }
  });
});

// ─── §51 audit corrections (BKK Oman Air, LAX Business Lounge) ──────────────
// Regression tests for db/patch-51-audit-corrections.ts. MH tier-mapping
// (Enrich Gold → oneworld_sapphire) was added in the same patch so LAX's
// R1→R2 shift can be verified with a carrier that was not on the pre-fix
// 9-carrier list. See docs §70.

describe('BKK Oman Air First & Business Class Lounge — §51 R2 → R1', () => {
  test('MH Enrich Gold (sapphire, not on [AY,WY] list) → not allowed via alliance_status', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'mh-enrich', tierName: 'Gold' }] },
      { operatingCarrier: 'MH', cabin: 'economy', departureAirport: 'BKK', arrivalAirport: 'KUL' },
      repos, { now: OPEN },
    );
    assert.equal(r.status?.allianceTier, 'oneworld_sapphire', 'MH Gold normalises to oneworld_sapphire');
    const lounge = find(r.lounges, 'Oman Air First & Business Class Lounge');
    assert.notEqual(lounge.access.status, 'allowed',
      'Post-§51: MH not on carrier_restriction ["AY","WY"] — must not be allowed via alliance_status');
  });

  test('AY Gold (on [AY,WY] list per §36) → allowed', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'BKK', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );
    const lounge = find(r.lounges, 'Oman Air First & Business Class Lounge');
    assert.equal(lounge.access.status, 'allowed', 'AY on carrier list → allowed');
  });
});

describe('LAX The Los Angeles Business Lounge — §51 R1 → R2', () => {
  test('MH Enrich Gold (sapphire, NOT on pre-fix 9-carrier list) → allowed post-fix', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'mh-enrich', tierName: 'Gold' }] },
      { operatingCarrier: 'MH', cabin: 'economy', departureAirport: 'LAX', arrivalAirport: 'KUL' },
      repos, { now: OPEN },
    );
    assert.equal(r.status?.allianceTier, 'oneworld_sapphire', 'MH Gold normalises to oneworld_sapphire');
    const lounge = find(r.lounges, 'The Los Angeles Business Lounge');
    assert.equal(lounge.access.status, 'allowed',
      'Post-§51: all_alliance sapphire — any oneworld carrier grants access');
  });

  test('AY Gold (was on pre-fix list; still allowed post-fix) → allowed regression', () => {
    const r = findEntitlementsAtAirport(
      { statusCards: [{ programCode: 'ay-plus', tierName: 'Gold' }] },
      { operatingCarrier: 'AY', cabin: 'economy', departureAirport: 'LAX', arrivalAirport: 'HEL' },
      repos, { now: OPEN },
    );
    const lounge = find(r.lounges, 'The Los Angeles Business Lounge');
    assert.equal(lounge.access.status, 'allowed', 'AY still allowed post-fix (regression)');
  });
});
