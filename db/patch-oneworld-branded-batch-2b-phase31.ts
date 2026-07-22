/**
 * Phase 31 (Batch 2b): Seed 26 airline-branded oneworld lounges — CX + JL + QF.
 *
 * Second all_alliance batch. Same Ryhmä 2 shape as Phase 30 (Batch 2a):
 * one alliance_status channel per lounge, `allianceAccess = 'all_alliance'`,
 * minAllianceTier `oneworld_sapphire`, no carrier list, no PP/paid,
 * confidence 0.99. Any oneworld Sapphire+ pax on any oneworld-operated
 * flight → `allowed`; different-alliance flight → `not_applicable`.
 *
 * Depends on: patch-seed-oneworld-carriers-phase30.ts (seeds CX + QF).
 * JL was already in airlines pre-baseline.
 *
 * Cathay Pacific (CX, 11 → 10 lounges — 1 skipped):
 *   CDG  Cathay Pacific Lounge
 *   BKK  Cathay Pacific Lounge
 *   SIN  Cathay Pacific Lounge
 *   HKG  The Bridge / The Deck / The Pier Business / The Pier First / The Wing First  (5 at CX hub)
 *   NRT  Cathay Pacific Lounge  ← SKIPPED (temporarily closed per oneworld.com; §48)
 *   HND  Cathay Pacific Lounge
 *   PVG  Cathay Pacific Lounge
 *
 * Japan Airlines / JAL Sakura (JL, 9 lounges):
 *   BKK  Sakura Lounge
 *   NRT  First Class Lounge + Sakura Domestic + Sakura International  (3 at NRT hub)
 *   HND  First Class + Sakura + Sakura Domestic + Sakura Sky View     (4 at HND hub)
 *   NGO  Sakura Lounge
 *
 * Qantas (QF, 7 lounges):
 *   SIN  The Qantas Singapore Lounge
 *   HKG  Qantas Hong Kong International Lounge
 *   LAX  Qantas First Lounge
 *   MEL  Domestic Business + International Business + International First + The Qantas Club (Domestic)  (4 at MEL hub)
 *
 * Total: 10 + 9 + 7 = 26 lounges, 26 channels.
 *
 * The three "hub" airports (HKG for CX, NRT+HND for JL, MEL for QF)
 * account for 13 of the 26 lounges. Each hub uses distinct lounge names,
 * so the (airport_id, name) unique constraint handles them without
 * name-suffix engineering.
 *
 * Zone note: none of the lounges are seeded with a Schengen/non-Schengen
 * area — all Asia-Pacific + LAX. `area = 'all'` uniformly.
 *
 * NOT included:
 *   NRT Cathay Pacific Lounge  — temporarily closed (§48, watch reopen)
 *   Third-party lounges at these airports (Miracle @ BKK, Marhaba @ SIN
 *   and MEL, Plaza Premium @ HKG, etc.) — these are Ryhmä 1 and belong
 *   in a later batch (Phase 33+).
 *
 * Sources:
 *   oneworld.com/airport-lounge-results (Phase 30 scrape verified all 26 lounges)
 *   cathaypacific.com/lounges  (CX operator reference)
 *   jal.co.jp/en/service/lounge  (JAL operator reference)
 *   qantas.com/us/en/travel-info/travel-updates/lounges.html  (QF operator reference)
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
const SOURCE_CX       = 'https://www.cathaypacific.com/cx/en_HK/travel-information/airport-and-flight/lounges.html';
const SOURCE_JL       = 'https://www.jal.co.jp/en/service/lounge/';
const SOURCE_QF       = 'https://www.qantas.com/us/en/travel-info/travel-updates/lounges.html';

interface LoungeSpec {
  iata:                string;
  name:                string;
  locationDescription: string;
  tier:                'ultra_premium' | 'premium' | 'standard';
  loungeClass:         'first' | 'business' | 'standard';
  openingHours:        string | null;
  amenities:           string[];
  sourceUrl:           string;
}

const RYHMA_2_CONFIDENCE = 0.99;
const RYHMA_2_MIN_TIER   = 'oneworld_sapphire';

// Amenity presets. Airline-branded lounges consistently offer the
// same 5-6 baseline amenities; first/flagship-class lounges add more.
const STANDARD_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Workspace'];
const PREMIUM_AMENITIES  = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];
const FIRST_AMENITIES    = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room', 'Spa'];

const LOUNGES: LoungeSpec[] = [
  // ── CX Cathay Pacific (10 — NRT skipped, temporarily closed) ────────────
  {
    iata: 'CDG', name: 'Cathay Pacific Lounge',
    locationDescription: 'Terminal 2, connector building between Terminals 2A and 2C, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'BKK', name: 'Cathay Pacific Lounge',
    locationDescription: 'Main Terminal, Concourse G, 3rd floor, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'SIN', name: 'Cathay Pacific Lounge',
    locationDescription: 'Terminal 4, Departure Transit Hall, mezzanine level, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'HKG', name: 'Cathay Pacific The Bridge',
    locationDescription: 'Terminal 1, near Gate 35, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'HKG', name: 'Cathay Pacific The Deck',
    locationDescription: 'Terminal 1, Level 7, near Gate 6, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'HKG', name: 'Cathay Pacific The Pier, Business',
    locationDescription: 'Terminal 1, Level 6, near Gate 65, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'HKG', name: 'Cathay Pacific The Pier, First',
    locationDescription: 'Terminal 1, Level 6, near Gate 63, after security',
    tier: 'ultra_premium', loungeClass: 'first',
    openingHours: null, amenities: FIRST_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'HKG', name: 'Cathay Pacific The Wing, First',
    locationDescription: 'Terminal 1, Level 7, Gates 1–4, after security',
    tier: 'ultra_premium', loungeClass: 'first',
    openingHours: null, amenities: FIRST_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'HND', name: 'Cathay Pacific Lounge',
    locationDescription: 'Terminal 3, Level 6, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_CX,
  },
  {
    iata: 'PVG', name: 'Cathay Pacific Lounge',
    locationDescription: 'Terminal 2, Gate D69, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_CX,
  },

  // ── JL Japan Airlines / Sakura (9) ──────────────────────────────────────
  {
    iata: 'BKK', name: 'Japan Airlines Sakura Lounge',
    locationDescription: 'Main Terminal, Concourse D, 3rd floor, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_JL,
  },
  {
    iata: 'NRT', name: 'Japan Airlines First Class Lounge',
    locationDescription: 'Terminal 2, Levels 3 & 4, after security',
    tier: 'ultra_premium', loungeClass: 'first',
    openingHours: null, amenities: FIRST_AMENITIES, sourceUrl: SOURCE_JL,
  },
  {
    iata: 'NRT', name: 'Japan Airlines Sakura Lounge (Domestic)',
    locationDescription: 'Terminal 2, Level 3, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_JL,
  },
  {
    iata: 'NRT', name: 'Japan Airlines Sakura Lounge (International)',
    locationDescription: 'Terminal 2, Levels 3 & 4, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_JL,
  },
  {
    iata: 'HND', name: 'Japan Airlines First Class Lounge',
    locationDescription: 'International Terminal, Level 4, near Gate 112, after security',
    tier: 'ultra_premium', loungeClass: 'first',
    openingHours: null, amenities: FIRST_AMENITIES, sourceUrl: SOURCE_JL,
  },
  {
    iata: 'HND', name: 'Japan Airlines Sakura Lounge',
    locationDescription: 'International Terminal, Level 4, near Gate 114, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_JL,
  },
  {
    iata: 'HND', name: 'Japan Airlines Sakura Lounge (Domestic)',
    locationDescription: 'Domestic Terminal 1, Level 3, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_JL,
  },
  {
    iata: 'HND', name: 'Japan Airlines Sakura Lounge (Sky View)',
    locationDescription: 'International Terminal, Level 5, near Gate 114, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_JL,
  },
  {
    iata: 'NGO', name: 'Japan Airlines Sakura Lounge',
    locationDescription: 'Main Terminal, Level 2, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_JL,
  },

  // ── QF Qantas (7) ───────────────────────────────────────────────────────
  {
    iata: 'SIN', name: 'The Qantas Singapore Lounge',
    locationDescription: 'Terminal 1, Level 3, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QF,
  },
  {
    iata: 'HKG', name: 'Qantas Hong Kong International Lounge',
    locationDescription: 'Terminal 1, Level 7, near Gate 5, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QF,
  },
  {
    iata: 'LAX', name: 'Qantas First Lounge',
    locationDescription: 'Tom Bradley International Terminal, Level 5, after security',
    tier: 'ultra_premium', loungeClass: 'first',
    openingHours: null, amenities: FIRST_AMENITIES, sourceUrl: SOURCE_QF,
  },
  {
    iata: 'MEL', name: 'Qantas Domestic Business',
    locationDescription: 'Domestic Terminal 1, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QF,
  },
  {
    iata: 'MEL', name: 'Qantas International Business',
    locationDescription: 'International Terminal 2, Level 1, after security',
    tier: 'premium', loungeClass: 'business',
    openingHours: null, amenities: PREMIUM_AMENITIES, sourceUrl: SOURCE_QF,
  },
  {
    iata: 'MEL', name: 'Qantas International First',
    locationDescription: 'International Terminal 2, Level 3, near Gates 9 & 10, after security',
    tier: 'ultra_premium', loungeClass: 'first',
    openingHours: null, amenities: FIRST_AMENITIES, sourceUrl: SOURCE_QF,
  },
  {
    iata: 'MEL', name: 'The Qantas Club (Domestic)',
    locationDescription: 'Domestic Terminal 1, after security',
    tier: 'standard', loungeClass: 'standard',
    openingHours: null, amenities: STANDARD_AMENITIES, sourceUrl: SOURCE_QF,
  },
];

// Verify prerequisite carriers seeded (CX + QF from Phase 30)
for (const code of ['CX', 'QF']) {
  const row = db.prepare(`SELECT id FROM airlines WHERE iata_code = ?`).get(code) as { id: number } | undefined;
  if (!row) {
    console.error(`${code} not found in airlines — run patch-seed-oneworld-carriers-phase30.ts first`);
    process.exit(1);
  }
}

const airportIds: Record<string, number> = {};
for (const iata of ['CDG', 'BKK', 'SIN', 'HKG', 'HND', 'NRT', 'NGO', 'LAX', 'MEL', 'PVG']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) { console.error(`${iata} airport not found — aborting`); process.exit(1); }
  airportIds[iata] = row.id;
}

db.transaction(() => {
  let loungesInserted = 0, loungesSkipped = 0, channelsInserted = 0, channelsSkipped = 0;

  for (const spec of LOUNGES) {
    const airportId = airportIds[spec.iata];
    let loungeId: number;
    const existing = db.prepare(`
      SELECT id FROM lounges WHERE airport_id = ? AND name = ?
    `).get(airportId, spec.name) as { id: number } | undefined;

    if (existing) {
      loungeId = existing.id;
      console.log(`  ↩ ${spec.iata} ${spec.name}: already in DB (id=${loungeId}) — skipping lounge insert`);
      loungesSkipped++;
    } else {
      const result = db.prepare(`
        INSERT INTO lounges
          (airport_id, terminal_id, name, location_description,
           tier, lounge_class, area, opening_hours, amenities)
        VALUES (?, NULL, ?, ?, ?, ?, 'all', ?, ?)
      `).run(
        airportId, spec.name, spec.locationDescription, spec.tier, spec.loungeClass,
        spec.openingHours, JSON.stringify(spec.amenities),
      );
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ Inserted ${spec.iata} ${spec.name} (id=${loungeId}, tier=${spec.tier})`);
      loungesInserted++;
    }

    const existingCh = db.prepare(`
      SELECT id FROM lounge_access_channels
      WHERE lounge_id = ? AND channel_type = 'alliance_status'
        AND alliance_access = 'all_alliance'
    `).get(loungeId) as { id: number } | undefined;

    if (existingCh) {
      console.log(`    ↩ alliance_status/all_alliance: exists — skipping`);
      channelsSkipped++;
      continue;
    }

    const chResult = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (?, 'alliance_status', 'all_alliance')
    `).run(loungeId);

    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction,
         valid_from, valid_to, priority, confidence, conditions,
         source_url, verified_at)
      VALUES (?, ?, NULL, '2020-01-01', NULL, 100, ?, NULL, ?, ?)
    `).run(chResult.lastInsertRowid, RYHMA_2_MIN_TIER, RYHMA_2_CONFIDENCE, spec.sourceUrl, TODAY);

    console.log(`    ✓ Added alliance_status/all_alliance (${RYHMA_2_MIN_TIER}, conf ${RYHMA_2_CONFIDENCE})`);
    channelsInserted++;
  }

  console.log(`\nDone.  lounges: inserted=${loungesInserted} skipped=${loungesSkipped}  channels: inserted=${channelsInserted} skipped=${channelsSkipped}`);
  console.log(`Ryhmä 2 model: 26 lounges (CX 10 + JL 9 + QF 7). Skipped: NRT Cathay Pacific Lounge (temporarily closed, §48).`);
})();

db.close();
