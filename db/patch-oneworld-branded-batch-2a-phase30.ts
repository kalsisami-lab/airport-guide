/**
 * Phase 30 (Batch 2a): Seed 17 airline-branded oneworld lounges — AA + Alaska.
 *
 * First all_alliance-shaped multi-airport batch. Every lounge here is
 * an airline-operated brand lounge (American Airlines Admirals Club,
 * AA Flagship Lounge, Alaska Lounge) that oneworld's access policy
 * grants to ANY oneworld Sapphire+ passenger flying on ANY oneworld-
 * operated flight. The carrier list shown on oneworld.com for these
 * cards is informational, NOT restrictive — hence the all_alliance
 * model (Phase 21 §17 shape, same as HEL Finnair Lounge).
 *
 * Depends on:
 *   patch-seed-oneworld-carriers-phase30.ts  (seeds CX, QF, MH, AS, WY)
 *   For Batch 2a specifically, only AS is a new dependency; AA is
 *   already in airlines from pre-baseline.
 *
 * Airports (all seeded Phase 20 or earlier):
 *   CDG (Charles de Gaulle, id=55)  — 1 lounge
 *   DFW (Dallas-Fort Worth, id=121) — 6 lounges (5 Admirals + 1 Flagship)
 *   LAX (Los Angeles, id=122)       — 3 lounges (Alaska + Admirals + Flagship)
 *   MIA (Miami, id=123)             — 3 lounges (Admirals x2 + Flagship)
 *   ORD (Chicago O'Hare, id=120)    — 2 lounges (Admirals + Flagship)
 *   SEA (Seattle, id=124)           — 1 lounge (Alaska)
 *   YYZ (Toronto Pearson, id=125)   — 1 lounge (Admirals)
 *
 * Seed model per lounge (Ryhmä 2 / all_alliance):
 *   Single alliance_status channel:
 *     allianceAccess:  'all_alliance'
 *     minAllianceTier: 'oneworld_sapphire'
 *     carrierRestriction: NULL   ← the key difference from Ryhmä 1
 *     priority: 100, confidence: 0.99
 *   No PP/LK/DP or paid channels. Airline-brand lounges are not on
 *   the PP network and don't do walk-in access. A non-oneworld pax
 *   without status → `denied`, not `paid_available`.
 *
 * Engine behavior for Ryhmä 2 (verified in
 * lib/engine/evaluateLoungeAccess.ts:130–357):
 *   AY Gold + AY-flight       → allowed via oneworld_sapphire (K1)
 *   BA Gold + BA-flight       → allowed via oneworld_sapphire (K2)
 *   LH Senator + LH-flight    → not_applicable ("This is a oneworld lounge; your flight is on a different alliance carrier") (K3)
 *   AY Gold + unknown carrier → likely_allowed conf 0.6 (K4)
 *   AY Silver (< Sapphire)    → denied (tier gate) (K5)
 *   AY Platinum (Emerald ≥ Sapphire) → allowed (K6)
 *   Amex Platinum (no status) → denied (all_alliance requires status) (K7)
 *
 * The 17 lounges below cover both AA Admirals Club (mainstream oneworld
 * lounge) and AA Flagship Lounge (premium tier, but same all_alliance
 * shape — the Emerald-only Flagship restrictions are marketing, not
 * an engine-level tier gate for Sapphire access). Alaska Lounge follows
 * the same shape post-2021 oneworld join.
 *
 * NOT included:
 *   MIA "Admirals Club" (short-name entry, [AT] only, no tiers) — appears
 *     to be a malformed / partial entry on oneworld.com; skipped as
 *     ambiguous. The "American Airlines Admirals Club" MIA entry is
 *     the canonical one and IS included.
 *
 * Sources:
 *   oneworld.com/airport-lounge-results (per-airport pages, Phase 30 scrape)
 *   aa.com/admiralsclub  (location + hours reference)
 *   alaskaair.com/lounges
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
const SOURCE_AA       = 'https://www.aa.com/admiralsclub';
const SOURCE_ALASKA   = 'https://www.alaskaair.com/lounges';

interface LoungeSpec {
  iata:                string;
  name:                string;
  locationDescription: string;
  tier:                'ultra_premium' | 'premium' | 'standard';
  loungeClass:         'first' | 'business' | 'standard';
  area:                'schengen' | 'non_schengen' | 'international' | 'all';
  openingHours:        string | null;
  amenities:           string[];
  sourceUrl:           string;   // operator source (for the single channel)
}

// All 17 lounges use the same channel spec — one alliance_status /
// all_alliance / sapphire / conf 0.99 rule. Encoded here as a constant
// so the loop is trivial.
const RYHMA_2_CONFIDENCE = 0.99;
const RYHMA_2_MIN_TIER   = 'oneworld_sapphire';

const LOUNGES: LoungeSpec[] = [
  // ── CDG (1) ─────────────────────────────────────────────────────────────
  {
    iata: 'CDG', name: 'American Airlines Admirals Club',
    locationDescription: 'Terminal 2A, between Terminals 2A and 2C, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },

  // ── ORD (2) ─────────────────────────────────────────────────────────────
  {
    iata: 'ORD', name: 'American Airlines Admirals Club',
    locationDescription: 'Terminal 3, Concourse H/K, between gates H6 and K6, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
  {
    iata: 'ORD', name: 'American Airlines Flagship Lounge',
    locationDescription: 'Terminal 3, crosswalk between gates H6 and K6, after security',
    tier: 'ultra_premium', loungeClass: 'first', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room'],
    sourceUrl: SOURCE_AA,
  },

  // ── DFW (6 — 5 Admirals + 1 Flagship) ───────────────────────────────────
  {
    iata: 'DFW', name: 'American Airlines Admirals Club - Terminal A',
    locationDescription: 'Terminal A, opposite Gate 24, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
  {
    iata: 'DFW', name: 'American Airlines Admirals Club - Terminal B',
    locationDescription: 'Terminal B, between Gates 3 and 4, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
  {
    iata: 'DFW', name: 'American Airlines Admirals Club - Terminal C',
    locationDescription: 'Terminal C, between Gates 19 and 20, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
  {
    iata: 'DFW', name: 'American Airlines Admirals Club - Terminal D',
    locationDescription: 'Terminal D, between gates D21 and D22, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
  {
    iata: 'DFW', name: 'American Airlines Admirals Club - Terminal E',
    locationDescription: 'Terminal E Satellite, mezzanine level, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
  {
    iata: 'DFW', name: 'American Airlines Flagship Lounge',
    locationDescription: 'Terminal D, between gates D21 and D22, after security',
    tier: 'ultra_premium', loungeClass: 'first', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room'],
    sourceUrl: SOURCE_AA,
  },

  // ── LAX (3 — Alaska + Admirals + Flagship) ──────────────────────────────
  {
    iata: 'LAX', name: 'Alaska Lounge',
    locationDescription: 'Terminal 6, mezzanine level, near gate 64, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_ALASKA,
  },
  {
    iata: 'LAX', name: 'American Airlines Admirals Club',
    locationDescription: 'American Eagle Regional Terminal, opposite Gates 52D and 52E, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
  {
    iata: 'LAX', name: 'American Airlines Flagship Lounge',
    locationDescription: 'Terminal 4, near gate 41, before security',
    tier: 'ultra_premium', loungeClass: 'first', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room'],
    sourceUrl: SOURCE_AA,
  },

  // ── MIA (2 canonical — the short-name "Admirals Club" [AT] entry is skipped as malformed) ──
  {
    iata: 'MIA', name: 'American Airlines Admirals Club',
    locationDescription: 'North Terminal, Concourse D, opposite Gate D30, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
  {
    iata: 'MIA', name: 'American Airlines Flagship Lounge',
    locationDescription: 'North Terminal, Concourse D, opposite Gate D30, after security',
    tier: 'ultra_premium', loungeClass: 'first', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room'],
    sourceUrl: SOURCE_AA,
  },

  // ── SEA (1 — Alaska) ────────────────────────────────────────────────────
  {
    iata: 'SEA', name: 'Alaska Lounge',
    locationDescription: 'Main Terminal, Concourse C, mezzanine level next to Gate C-16, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_ALASKA,
  },

  // ── YYZ (1 — Admirals) ──────────────────────────────────────────────────
  {
    iata: 'YYZ', name: 'American Airlines Admirals Club',
    locationDescription: 'Terminal 3, Transfer Level, near duty free stores, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    sourceUrl: SOURCE_AA,
  },
];

// Verify prerequisite carriers seeded (AS specifically for Alaska Lounges)
const as = db.prepare(`SELECT id FROM airlines WHERE iata_code = 'AS'`).get() as { id: number } | undefined;
if (!as) {
  console.error('AS (Alaska Airlines) not found in airlines — run patch-seed-oneworld-carriers-phase30.ts first');
  process.exit(1);
}

// Resolve airport ids (fail fast if any missing)
const airportIds: Record<string, number> = {};
for (const iata of ['CDG', 'ORD', 'DFW', 'LAX', 'MIA', 'SEA', 'YYZ']) {
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
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        airportId, spec.name, spec.locationDescription, spec.tier, spec.loungeClass,
        spec.area, spec.openingHours, JSON.stringify(spec.amenities),
      );
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ Inserted ${spec.iata} ${spec.name} (id=${loungeId}, tier=${spec.tier})`);
      loungesInserted++;
    }

    // Single all_alliance oneworld channel per lounge
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
  console.log(`Ryhmä 2 model: all 17 lounges use all_alliance oneworld / sapphire+ / conf 0.99, no carrier list, no §36.`);
})();

db.close();
