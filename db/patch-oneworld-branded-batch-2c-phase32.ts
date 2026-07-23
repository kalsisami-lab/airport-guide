/**
 * Phase 32 (Batch 2c): Seed 16 airline-branded oneworld lounges — BA + QR + WY.
 *
 * Third all_alliance batch (after Phase 30 = AA+AS, Phase 31 = CX+JL+QF).
 * Same Ryhmä 2 shape: single alliance_status/all_alliance channel per lounge,
 * min tier per lounge class, no carrier list, confidence 0.99, no PP/paid.
 *
 * Distribution:
 *   BA British Airways  (7)  EDI · FCO · GVA · LIN · MIA · SEA · SIN
 *   QR Qatar Airways    (8)  BKK · SIN · DOH ×6 (Al Mourjan Garden, Al Mourjan
 *                             South, Al Safwa First, Gold South, Platinum
 *                             South, Silver South)
 *   WY Oman Air         (1)  BKK (First & Business Class Lounge)
 *
 * DOH is the QR hub — 6 lounges in one airport (mirrors Phase 31 HKG=5 for CX,
 * MEL=4 for QF). DOH airport row seeded by patch-seed-doh-airport-batch-2c.ts.
 *
 * Tier assignment per lounge class:
 *   business (default) → oneworld_sapphire   (BA Lounges, QR Premium/Gold, WY)
 *   first / flagship   → oneworld_emerald    (Al Safwa First, QR Platinum South)
 *   below-sapphire     → oneworld_ruby       (QR Silver South — QR Silver members
 *                                              are oneworld ruby, one tier below
 *                                              sapphire)
 *
 * Skipped:
 *   - Concorde Room-style tiers with cabin gates (BA Concorde Room at LHR
 *     is already correctly modeled via patch-lhr-concorde-room-cabin-fix.ts —
 *     not in this batch's scrape scope anyway since LHR isn't scraped).
 *
 * All 3 carriers already in `airlines`:
 *   BA (2)  QR (4)  WY (24 from Phase 30)
 * No new carrier seed required.
 *
 * NOT included:
 *   BA at LHR (scrape doesn't cover LHR; deferred to LHR project)
 *   QR at LHR, CDG, FRA (not in scrape scope for LHR, FRA is "demo" airport
 *     deferred to owner review)
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results  (per-airport, primary)
 *   https://www.britishairways.com/lounges           (BA locations reference)
 *   https://www.qatarairways.com/en/lounges          (QR locations reference)
 *   https://www.omanair.com                          (WY BKK reference)
 *
 * Idempotent: skips by (airport_id, name); channel guarded by
 * (lounge_id, channel_type, alliance_access).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_BA       = 'https://www.britishairways.com/en-gb/information/at-the-airport/lounges';
const SOURCE_QR       = 'https://www.qatarairways.com/en/premium/lounges.html';
const SOURCE_WY       = 'https://www.omanair.com/en/services-on-air-oman-air/al-bustan-first-class-business-class-lounge';

interface LoungeSpec {
  iata:                string;
  name:                string;
  locationDescription: string;
  tier:                'ultra_premium' | 'premium' | 'standard';
  loungeClass:         'first' | 'business' | 'standard';
  minAllianceTier:     'oneworld_emerald' | 'oneworld_sapphire' | 'oneworld_ruby';
  openingHours:        string | null;
  amenities:           string[];
  sourceUrl:           string;
}

const RYHMA_2_CONFIDENCE = 0.99;

const STANDARD_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Workspace'];
const PREMIUM_AMENITIES  = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];
const FIRST_AMENITIES    = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room', 'Spa'];

const LOUNGES: LoungeSpec[] = [
  // ── BA British Airways (7) ──────────────────────────────────────────────
  { iata: 'EDI', name: 'British Airways Lounge',
    locationDescription: 'Departures level, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_BA },
  { iata: 'FCO', name: 'British Airways Lounge',
    locationDescription: 'Terminal 3, Extra-Schengen area, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_BA },
  { iata: 'GVA', name: 'British Airways Lounge',
    locationDescription: 'Terminal 1, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_BA },
  { iata: 'LIN', name: 'British Airways Lounge (Open)',
    locationDescription: 'Departures area, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_BA },
  { iata: 'MIA', name: 'British Airways Lounge',
    locationDescription: 'Concourse E, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_BA },
  { iata: 'SEA', name: 'British Airways Lounge',
    locationDescription: 'Concourse S, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_BA },
  { iata: 'SIN', name: 'British Airways Lounge',
    locationDescription: 'Terminal 1, Level 3, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_BA },

  // ── QR Qatar Airways (8) — 6 at DOH hub ─────────────────────────────────
  { iata: 'BKK', name: 'Qatar Airways Premium Lounge',
    locationDescription: 'Main Terminal, Concourse G, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QR },
  { iata: 'SIN', name: 'Qatar Airways Premium Lounge',
    locationDescription: 'Terminal 1, Level 3, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QR },
  { iata: 'DOH', name: 'Al Mourjan Business Lounge - The Garden',
    locationDescription: 'Hamad International, Concourse D, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QR },
  { iata: 'DOH', name: 'Al Mourjan Business Lounge - South',
    locationDescription: 'Hamad International, South Node, Level 3, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QR },
  { iata: 'DOH', name: 'Al Safwa First Lounge',
    locationDescription: 'Hamad International, dedicated First-class terminal, after security',
    tier: 'ultra_premium', loungeClass: 'first', minAllianceTier: 'oneworld_emerald',
    openingHours: null, amenities: FIRST_AMENITIES, sourceUrl: SOURCE_QR },
  { iata: 'DOH', name: 'Qatar Airways Gold Lounge - South',
    locationDescription: 'Hamad International, South Node, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QR },
  { iata: 'DOH', name: 'Qatar Airways Platinum Lounge - South',
    locationDescription: 'Hamad International, South Node, upper level, after security',
    tier: 'ultra_premium', loungeClass: 'first', minAllianceTier: 'oneworld_emerald',
    openingHours: null, amenities: FIRST_AMENITIES, sourceUrl: SOURCE_QR },
  { iata: 'DOH', name: 'Qatar Airways Silver Lounge - South',
    locationDescription: 'Hamad International, South Node, after security',
    tier: 'standard', loungeClass: 'standard', minAllianceTier: 'oneworld_ruby',
    openingHours: null, amenities: STANDARD_AMENITIES, sourceUrl: SOURCE_QR },

  // ── WY Oman Air (1) ─────────────────────────────────────────────────────
  { iata: 'BKK', name: 'Oman Air First & Business Class Lounge',
    locationDescription: 'Main Terminal, after security',
    tier: 'premium', loungeClass: 'business', minAllianceTier: 'oneworld_sapphire',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_WY },
];

// Verify prereq: all carriers in `airlines`
for (const code of ['BA', 'QR', 'WY']) {
  const row = db.prepare(`SELECT id FROM airlines WHERE iata_code = ?`).get(code) as { id: number } | undefined;
  if (!row) { console.error(`${code} not found in airlines — aborting`); process.exit(1); }
}

// Verify DOH airport seeded (via patch-seed-doh-airport-batch-2c.ts)
const airportIds: Record<string, number> = {};
for (const iata of ['BKK', 'DOH', 'EDI', 'FCO', 'GVA', 'LIN', 'MIA', 'SEA', 'SIN']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) { console.error(`${iata} airport not found — run patch-seed-doh-airport-batch-2c.ts first if DOH missing`); process.exit(1); }
  airportIds[iata] = row.id;
}

db.transaction(() => {
  let lI = 0, lS = 0, cI = 0, cS = 0;
  for (const spec of LOUNGES) {
    const airportId = airportIds[spec.iata];
    let loungeId: number;
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;
    if (existing) { loungeId = existing.id; console.log(`  ↩ ${spec.iata} ${spec.name}: id=${loungeId} — skip`); lS++; }
    else {
      const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, ?, ?, ?, 'all', ?, ?)`)
        .run(airportId, spec.name, spec.locationDescription, spec.tier, spec.loungeClass, spec.openingHours, JSON.stringify(spec.amenities));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.iata} ${spec.name} (id=${loungeId}, tier=${spec.minAllianceTier})`);
      lI++;
    }

    const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = 'alliance_status' AND alliance_access = 'all_alliance'`).get(loungeId) as { id: number } | undefined;
    if (existingCh) { cS++; continue; }
    const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, 'alliance_status', 'all_alliance')`).run(loungeId);
    db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, ?, NULL, '2020-01-01', NULL, 100, ?, NULL, ?, ?)`)
      .run(chResult.lastInsertRowid, spec.minAllianceTier, RYHMA_2_CONFIDENCE, spec.sourceUrl, TODAY);
    cI++;
  }
  console.log(`\nDone.  lounges: inserted=${lI} skipped=${lS}  channels: inserted=${cI} skipped=${cS}`);
})();
db.close();
