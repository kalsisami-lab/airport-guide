/**
 * Phase 33 (UK Batch — LHR): Seed 12 oneworld lounges + remove legacy demo entry.
 *
 * LHR is not in the oneworld scraper input (iatas.txt). Data collected
 * manually from oneworld.com/airport-lounge-results?location=LHR and
 * classified by wording per §51 (Ryhmä 1 vs Ryhmä 2) and §52 (Emerald
 * Tier vs First Class wording).
 *
 * All LHR lounges: area='all' (UK not in Schengen).
 *
 * ── Ryhmä 2 all_alliance / oneworld_sapphire (8) — "ANY oneworld" wording ─
 *   T3  American Airlines Admirals Club
 *   T5  BA Galleries North Club
 *   T5  BA Galleries South First and Galleries Club
 *   T5  BA Galleries T5B Club
 *   T3  BA T3 Galleries First and Galleries Club
 *   T3  Cathay Pacific Business Class Lounge
 *   T4  Qatar Airways Frequent Flyer Lounge
 *   T3  The Qantas London Lounge
 *
 * ── Ryhmä 2 all_alliance / oneworld_emerald (2) — §52 OR-model ────────────
 * Data lists "First Class" AND "Emerald Tier" as separate lines →
 * Emerald status ALONE qualifies (Business ticket OK).
 *   T3  American Airlines International First Class Lounge
 *   T3  Cathay Pacific First Class Lounge
 * User's first-hand field report: Finnair Platinum (Emerald) + BA
 * Business ticket → entered CX First Class Lounge. Contrast with BA
 * Concorde Room (Phase #6): Platinum + Business → denied.
 *
 * ── Ryhmä 1 carrier_specific + §36 (2) — "THESE oneworld only" wording ────
 *   T4  Qatar Airways Premium Lounge  [MH, QR, AT, AY]  §36
 *       cabin condition in [first, business] (Business Lite exclusion
 *       not modeled — see §53)
 *   T4  Plaza Premium Lounge          [AT, AY]          §36
 *
 * ── Legacy entry removal ────────────────────────────────────────────────
 * Existing "British Airways Galleries Club Lounge" (id=11, all_alliance
 * oneworld_sapphire) is an ambiguous pre-baseline entry that predates
 * oneworld.com's current 4-way Galleries split (North Club / South First
 * & Club / T5B Club / T3 First & Club). Deleted here and replaced with
 * the 4 specific entries. Idempotent: skips deletion if entry is missing.
 *
 * ── Not seeded ──────────────────────────────────────────────────────────
 *   BA Concorde Room (T5) — Phase #6 model retained (airline_own [BA,IB]
 *     + cabin=first). §52-compliant "First Class only" wording without
 *     "Emerald Tier" line.
 *   BA Arrivals Lounge (T5) — arrivals lounges not modeled; §54.
 *   Aspire, Centurion, No.1 Traveller (pre-baseline demo entries) —
 *     not on oneworld.com list; PP/Amex channels retained.
 *
 * ── No new carriers ────────────────────────────────────────────────────
 * All 8 relevant carriers (AA, AY, AT, BA, CX, IB, MH, QF, QR) already
 * in `airlines` from prior batches.
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=LHR
 *   https://www.britishairways.com/en-gb/information/at-the-airport/lounges
 *   https://www.aa.com/i18n/travel-info/experience/lounges/admirals-club.jsp
 *   https://www.cathaypacific.com/cx/en_HK/travel-information/airport-and-flight/lounges.html
 *   https://www.qatarairways.com/en/premium/lounges.html
 *   https://www.qantas.com/us/en/travel-info/travel-updates/lounges.html
 *   https://www.plazapremiumlounge.com
 *
 * Idempotent: skips by (airport_id, name); channels by (lounge_id,
 * channel_type, alliance_access).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_BA       = 'https://www.britishairways.com/en-gb/information/at-the-airport/lounges';
const SOURCE_AA       = 'https://www.aa.com';
const SOURCE_CX       = 'https://www.cathaypacific.com/lounges';
const SOURCE_QR       = 'https://www.qatarairways.com/en/premium/lounges.html';
const SOURCE_QF       = 'https://www.qantas.com/us/en/travel-info/travel-updates/lounges.html';
const SOURCE_PLAZA    = 'https://www.plazapremiumlounge.com';
const SOURCE_PP       = 'https://www.prioritypass.com';

interface Ryhma2Spec {
  name: string;
  terminal: string | null;   // for locationDescription only; terminal_id stays NULL
  loungeClass: 'first' | 'business' | 'standard';
  tier: 'ultra_premium' | 'premium' | 'standard';
  minTier: 'oneworld_emerald' | 'oneworld_sapphire';
  sourceUrl: string;
}

interface Ryhma1Spec {
  name: string;
  terminal: string | null;
  loungeClass: 'first' | 'business' | 'standard';
  tier: 'ultra_premium' | 'premium' | 'standard';
  carriers: string[];
  cabinCondition: { op: 'in' | 'equals'; field: 'passenger.cabin'; values?: string[]; value?: string } | null;
  operatorSource: string;
}

const RYHMA_2_LOUNGES: Ryhma2Spec[] = [
  // Ryhmä 2 all_alliance / sapphire (8)
  { name: 'American Airlines Admirals Club',                    terminal: 'T3', loungeClass: 'business', tier: 'premium',       minTier: 'oneworld_sapphire', sourceUrl: SOURCE_AA },
  { name: 'BA Galleries North Club',                            terminal: 'T5', loungeClass: 'business', tier: 'premium',       minTier: 'oneworld_sapphire', sourceUrl: SOURCE_BA },
  { name: 'BA Galleries South First and Galleries Club',        terminal: 'T5', loungeClass: 'business', tier: 'premium',       minTier: 'oneworld_sapphire', sourceUrl: SOURCE_BA },
  { name: 'BA Galleries T5B Club',                              terminal: 'T5', loungeClass: 'business', tier: 'premium',       minTier: 'oneworld_sapphire', sourceUrl: SOURCE_BA },
  { name: 'BA T3 Galleries First and Galleries Club',           terminal: 'T3', loungeClass: 'business', tier: 'premium',       minTier: 'oneworld_sapphire', sourceUrl: SOURCE_BA },
  { name: 'Cathay Pacific Business Class Lounge',               terminal: 'T3', loungeClass: 'business', tier: 'premium',       minTier: 'oneworld_sapphire', sourceUrl: SOURCE_CX },
  { name: 'Qatar Airways Frequent Flyer Lounge',                terminal: 'T4', loungeClass: 'business', tier: 'premium',       minTier: 'oneworld_sapphire', sourceUrl: SOURCE_QR },
  { name: 'The Qantas London Lounge',                           terminal: 'T3', loungeClass: 'business', tier: 'premium',       minTier: 'oneworld_sapphire', sourceUrl: SOURCE_QF },

  // Ryhmä 2 all_alliance / emerald (2) — §52 OR-model
  { name: 'American Airlines International First Class Lounge', terminal: 'T3', loungeClass: 'first',    tier: 'ultra_premium', minTier: 'oneworld_emerald',  sourceUrl: SOURCE_AA },
  { name: 'Cathay Pacific First Class Lounge',                  terminal: 'T3', loungeClass: 'first',    tier: 'ultra_premium', minTier: 'oneworld_emerald',  sourceUrl: SOURCE_CX },
];

const RYHMA_1_LOUNGES: Ryhma1Spec[] = [
  { name: 'Qatar Airways Premium Lounge', terminal: 'T4', loungeClass: 'business', tier: 'premium',
    carriers: ['MH', 'QR', 'AT', 'AY'],  // §36 AY
    cabinCondition: { op: 'in', field: 'passenger.cabin', values: ['first', 'business'] },  // Business Lite exclusion not modeled — §53
    operatorSource: SOURCE_QR },
  { name: 'Plaza Premium Lounge', terminal: 'T4', loungeClass: 'business', tier: 'premium',
    carriers: ['AT', 'AY'],  // §36 AY
    cabinCondition: null,
    operatorSource: SOURCE_PLAZA },
];

const PREMIUM_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];
const FIRST_AMENITIES   = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room', 'Spa'];

const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = 'LHR'`).get() as { id: number } | undefined;
if (!airportRow) { console.error('LHR airport not found — aborting'); process.exit(1); }
const airportId = airportRow.id;

db.transaction(() => {
  // ── Step 1: Remove legacy "British Airways Galleries Club Lounge" ─────
  const legacy = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = 'British Airways Galleries Club Lounge'`).get(airportId) as { id: number } | undefined;
  if (legacy) {
    const channels = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ?`).all(legacy.id) as { id: number }[];
    for (const ch of channels) {
      db.prepare(`DELETE FROM lounge_access_rules WHERE channel_id = ?`).run(ch.id);
      db.prepare(`DELETE FROM lounge_access_channels WHERE id = ?`).run(ch.id);
    }
    db.prepare(`DELETE FROM lounges WHERE id = ?`).run(legacy.id);
    console.log(`  ✗ Deleted legacy "British Airways Galleries Club Lounge" (id=${legacy.id}) + ${channels.length} channels/rules — replaced by 4 specific Galleries entries`);
  } else {
    console.log(`  ↩ Legacy "British Airways Galleries Club Lounge" not present — nothing to delete`);
  }

  // ── Step 2: Insert Ryhmä 2 lounges ────────────────────────────────────
  let lI = 0, lS = 0, cI = 0;
  for (const spec of RYHMA_2_LOUNGES) {
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;
    let loungeId: number;
    if (existing) { loungeId = existing.id; console.log(`  ↩ ${spec.name}: id=${loungeId} — skip`); lS++; }
    else {
      const locationDesc = spec.terminal ? `${spec.terminal}, after security` : 'after security';
      const amenities = spec.loungeClass === 'first' ? FIRST_AMENITIES : PREMIUM_AMENITIES;
      const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, ?, ?, ?, 'all', NULL, ?)`)
        .run(airportId, spec.name, locationDesc, spec.tier, spec.loungeClass, JSON.stringify(amenities));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.name} (id=${loungeId}, tier=${spec.minTier})`);
      lI++;
    }
    const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = 'alliance_status' AND alliance_access = 'all_alliance'`).get(loungeId) as { id: number } | undefined;
    if (existingCh) continue;
    const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, 'alliance_status', 'all_alliance')`).run(loungeId);
    db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, ?, NULL, '2020-01-01', NULL, 100, 0.99, NULL, ?, ?)`)
      .run(chResult.lastInsertRowid, spec.minTier, spec.sourceUrl, TODAY);
    cI++;
  }

  // ── Step 3: Insert Ryhmä 1 lounges ────────────────────────────────────
  for (const spec of RYHMA_1_LOUNGES) {
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;
    let loungeId: number;
    if (existing) { loungeId = existing.id; console.log(`  ↩ ${spec.name}: id=${loungeId} — skip`); lS++; }
    else {
      const locationDesc = spec.terminal ? `${spec.terminal}, after security` : 'after security';
      const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, ?, ?, ?, 'all', NULL, ?)`)
        .run(airportId, spec.name, locationDesc, spec.tier, spec.loungeClass, JSON.stringify(PREMIUM_AMENITIES));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.name} (id=${loungeId}, carriers=[${spec.carriers.join(',')}])`);
      lI++;
    }
    // 5 channels for Ryhmä 1 (with cabin condition on alliance_status if present)
    const channels: Array<{ type: string; access: 'carrier_specific' | null; tier: string | null; carriers: string[] | null; cond: object | null; conf: number; src: string; }> = [
      { type: 'alliance_status', access: 'carrier_specific', tier: 'oneworld_sapphire', carriers: spec.carriers, cond: spec.cabinCondition, conf: 0.95, src: SOURCE_ONEWORLD },
      { type: 'priority_pass',   access: null, tier: null, carriers: null, cond: null, conf: 0.9,  src: SOURCE_PP },
      { type: 'lounge_key',      access: null, tier: null, carriers: null, cond: null, conf: 0.85, src: SOURCE_PP },
      { type: 'dragon_pass',     access: null, tier: null, carriers: null, cond: null, conf: 0.8,  src: SOURCE_PP },
      { type: 'paid',            access: null, tier: null, carriers: null, cond: null, conf: 0.9,  src: spec.operatorSource },
    ];
    for (const ch of channels) {
      const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = ? AND (alliance_access IS ? OR alliance_access = ?)`)
        .get(loungeId, ch.type, ch.access, ch.access) as { id: number } | undefined;
      if (existingCh) continue;
      const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, ?, ?)`).run(loungeId, ch.type, ch.access);
      const priority = ch.type === 'paid' ? 50 : 100;
      db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, ?, ?, ?)`)
        .run(chResult.lastInsertRowid, ch.tier, ch.carriers ? JSON.stringify(ch.carriers) : null, priority, ch.conf, ch.cond ? JSON.stringify(ch.cond) : null, ch.src, TODAY);
      cI++;
    }
  }

  console.log(`\nLHR done.  lounges: inserted=${lI} skipped=${lS}  channels: inserted=${cI}`);
  console.log(`Ryhmä 2 sapphire: 8 · Ryhmä 2 emerald: 2 · Ryhmä 1: 2 · legacy removed: 1`);
})();

db.close();
