/**
 * §69 Finnish regional airports — coverage + fast-track deny (2026-07-27).
 *
 * Sources:
 *   - Finavia per-airport pages (/services) — access-model determined from
 *     "Opening hours" field, not from facility name. See §69 rubric.
 *   - Sami field-report: HEL is the only Finnish airport with permanent
 *     fast track and international lounges.
 *
 * 15 airports scoped (all Finavia-listed regionals except HEL + military
 * Halli/Utti; POR/SVL/ENF deferred — not in airports table):
 *   IVL JOE JYV KAJ KAO KEM KOK KTT KUO MHQ OUL RVN TKU TMP VAA
 *
 * ── Coverage classification (§69 rubric, applied to access model) ────────
 *
 *   Ryhmä 4 = airport has a facility categorized as "Lounges" on Finavia's
 *             /services page AND opening hours indicate drop-in access
 *             (no "by agreement" qualifier). Facility exists as a walk-in
 *             physical space, not a bookable meeting room.
 *
 *   verified_none = everything else:
 *     - No VIP/Lounge/Meeting facility at all
 *     - Only "by agreement" bookable rooms (VIP Room or Meeting Room —
 *       classification by access model, not name)
 *     - Only cafés/shops
 *
 *   Meeting Room by name vs VIP Room by name is IRRELEVANT — access model
 *   from Opening Hours field is authoritative. "By agreement" → booking →
 *   verified_none. Drop-in (opening hours state terminal-hours without
 *   agreement qualifier) → potentially Ryhmä 4 if in Lounges category.
 *
 * verified_none (11): IVL, JOE, JYV, KAJ, KAO, KEM, KOK, KUO, MHQ, RVN, TMP
 * Ryhmä 4 (4):        KTT, OUL, TKU, VAA
 *
 * Notable case corrections vs. name-based intuition:
 *   - TKU "VIP Lounge, Turku" — Opening hours: "By agreement" → NOT drop-in.
 *     TKU's Ryhmä 4 status comes from "Working area (Lounges)", not this
 *     misleadingly-named booking-only VIP Lounge.
 *   - KTT "VIP Room" — Opening hours: "During terminal opening hours"
 *     (no by-agreement qualifier) → drop-in.
 *   - OUL Meeting Room Kaakkuri — drop-in per opening hours but VIP &
 *     Business category, not Lounges. OUL's Ryhmä 4 status comes from
 *     "Lounge: Hailuoto" (Lounges category, drop-in).
 *
 * ── Coverage_source_url semantic broadening (§69 records) ────────────────
 *
 * §67 originally said coverage_source_url should be NULL for unverified
 * rows (a URL there would "look sourced without being sourced"). §69
 * broadens the semantic: for airports that have been actively investigated
 * against a primary source but not fully modeled, coverage_source_url
 * points to the source. This is a new sub-state of `unverified`:
 *   - unverified + NULL source_url    = not investigated
 *   - unverified + source_url present = investigated, source consulted,
 *                                       but not fully modeled (Ryhmä 4
 *                                       here — Finavia lists a facility
 *                                       our schema doesn't model)
 *   - verified_none + source_url      = verified there's nothing here
 *   - verified_seeded + source_url    = full coverage recorded, source
 *                                       consulted
 *
 * UI implication: eventually the empty-lounge card at Ryhmä 4 airports
 * should show a "see source" link instead of a bare ? . NOT wired in
 * this PR — pure data change, UI is a separate follow-up.
 *
 * ── Fast track deny ──────────────────────────────────────────────────────
 *
 * All 15 get an absolute deny rule for fast_track_security (Sami field-
 * report: HEL only permanent fast track in Finland). Absolute in the sense
 * that no cabin/status combo passes — Business/First pax also denied,
 * because there is no facility to admit them.
 *
 *   action='deny', min_alliance_tier=NULL, carrier_restriction=NULL,
 *   conditions=NULL, tier_semantics='local' (not alliance-tier absence),
 *   priority=100
 *
 * Idempotency: per (airport_id, service_type, notes) using unique §69 notes
 * suffix. Coverage updates are idempotent by definition (SET to same value
 * is a no-op).
 *
 * Usage: npx tsx db/patch-finnish-regionals-coverage.ts
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const NOTES_FT_DENY = 'No fast track at this airport (§69 Finavia + Sami field-report)';

// Finavia URL slug per IATA. Verified against
// https://www.finavia.fi/en/airports (the site's official index).
const FINAVIA_SLUG: Record<string, string> = {
  IVL: 'ivalo',
  JOE: 'joensuu',
  JYV: 'jyvaskyla',
  KAJ: 'kajaani',
  KAO: 'kuusamo',
  KEM: 'kemi-tornio',
  KOK: 'kokkola-pietarsaari',
  KTT: 'kittila',
  KUO: 'kuopio',
  MHQ: 'mariehamn',
  OUL: 'oulu',
  RVN: 'rovaniemi',
  TKU: 'turku',
  TMP: 'tampere-pirkkala',
  VAA: 'vaasa',
};

// Coverage classification per §69 access-model rubric.
const VERIFIED_NONE = ['IVL', 'JOE', 'JYV', 'KAJ', 'KAO', 'KEM', 'KOK', 'KUO', 'MHQ', 'RVN', 'TMP'] as const;
const RYHMA_4       = ['KTT', 'OUL', 'TKU', 'VAA'] as const;

// Sanity check
if (VERIFIED_NONE.length !== 11 || RYHMA_4.length !== 4) {
  console.error(`Class counts wrong: verified_none=${VERIFIED_NONE.length}, ryhma_4=${RYHMA_4.length}`);
  process.exit(1);
}
const ALL_15 = [...VERIFIED_NONE, ...RYHMA_4];
if (Object.keys(FINAVIA_SLUG).length !== 15 || ALL_15.some((i) => !FINAVIA_SLUG[i])) {
  console.error(`FINAVIA_SLUG missing an IATA`);
  process.exit(1);
}

function servicesUrl(iata: string): string {
  return `https://www.finavia.fi/en/airports/${FINAVIA_SLUG[iata]}/services`;
}

// ── Resolve airport ids ────────────────────────────────────────────────────
const airportIds: Record<string, number> = {};
for (const iata of ALL_15) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) {
    console.error(`✗ ${iata}: airport row missing — aborting`);
    process.exit(1);
  }
  airportIds[iata] = row.id;
}

// ── Coverage updates ──────────────────────────────────────────────────────

let covUpdated = 0;
let covUnchanged = 0;
let ftInserted = 0;
let ftSkipped = 0;

db.transaction(() => {
  console.log(`\n═══ Coverage updates ═══`);
  for (const iata of ALL_15) {
    const isNone = (VERIFIED_NONE as readonly string[]).includes(iata);
    const targetStatus = isNone ? 'verified_none' : 'unverified';   // Ryhmä 4 stays unverified
    const url = servicesUrl(iata);
    const before = db.prepare(
      `SELECT lounge_coverage_status, coverage_source_url, coverage_verified_at FROM airports WHERE id = ?`,
    ).get(airportIds[iata]) as { lounge_coverage_status: string; coverage_source_url: string | null; coverage_verified_at: string | null };

    if (before.lounge_coverage_status === targetStatus && before.coverage_source_url === url && before.coverage_verified_at === TODAY) {
      console.log(`  ↩ ${iata}  ${targetStatus} + url + date  — unchanged`);
      covUnchanged++;
      continue;
    }

    db.prepare(
      `UPDATE airports SET lounge_coverage_status = ?, coverage_source_url = ?, coverage_verified_at = ? WHERE id = ?`,
    ).run(targetStatus, url, TODAY, airportIds[iata]);
    const tag = isNone ? 'verified_none' : 'unverified+source (Ryhmä 4)';
    console.log(`  ✓ ${iata}  → ${tag}  (${url})`);
    covUpdated++;
  }

  console.log(`\n═══ Fast track deny rules ═══`);
  for (const iata of ALL_15) {
    const existing = db.prepare(
      `SELECT id FROM airport_service_rules WHERE airport_id = ? AND service_type = 'fast_track_security' AND notes = ?`,
    ).get(airportIds[iata], NOTES_FT_DENY) as { id: number } | undefined;
    if (existing) {
      console.log(`  ↩ ${iata}  ft_deny  — exists id=${existing.id}`);
      ftSkipped++;
      continue;
    }
    const result = db.prepare(
      `INSERT INTO airport_service_rules
        (airport_id, service_type, action, provider, min_alliance_tier, carrier_restriction,
         conditions, priority, confidence, valid_from, valid_to, source_url, verified_at,
         tier_semantics, notes)
       VALUES (?, 'fast_track_security', 'deny', NULL, NULL, NULL, NULL, 100, 0.95,
               '2020-01-01', NULL, ?, ?, 'local', ?)`,
    ).run(airportIds[iata], servicesUrl(iata), TODAY, NOTES_FT_DENY);
    console.log(`  ✓ ${iata}  ft_deny  — id=${result.lastInsertRowid}`);
    ftInserted++;
  }
})();

console.log(`\n═══ Done ═══`);
console.log(`  Coverage: updated=${covUpdated}  unchanged=${covUnchanged}`);
console.log(`  Fast-track deny: inserted=${ftInserted}  skipped=${ftSkipped}`);
console.log(`  Airport classes: verified_none=${VERIFIED_NONE.length}, ryhma_4=${RYHMA_4.length}`);

db.close();
