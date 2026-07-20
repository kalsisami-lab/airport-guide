/**
 * Phase 26 (Batch 1): Seed 6 lounges across 4 Spanish leisure airports.
 *
 * First multi-airport batch. All lounges are the Aena Sala VIP model —
 * oneworld (carrier-specific) + PP/LK/DP + walk-in paid. No amex_centurion
 * (Amex Platinum reaches these via the shared PP network, same as AGP
 * Sala VIP in Phase 23).
 *
 * Airports (all seeded Phase 20):
 *   PMI (Palma de Mallorca)  — 3 lounges (mixed Schengen / non-Schengen)
 *   ALC (Alicante)           — 1 lounge
 *   VLC (Valencia)           — 1 lounge
 *   LPA (Gran Canaria)       — 1 lounge
 *
 * Depends on: AT (Royal Air Maroc) seeded via patch-seed-at-ram.ts. VLC
 * and LPA lounges include AT in their carrier_restriction lists.
 *
 * Critical seeding rule — AY in every oneworld carrier list:
 * -------------------------------------------------------------
 * oneworld.com's per-airport lounge finder shows only carriers that are
 * currently operating during the query season. Finnair (AY) flies to
 * these Spanish leisure destinations on winter schedule (Canaries,
 * partial mainland), so a summer-time scrape of oneworld.com omits AY.
 * Since these airports were included in the Phase 20 seed precisely
 * because Finnair serves them, AY MUST be in every list — otherwise a
 * winter AY passenger sees "no access" incorrectly. Confirmed first-hand:
 * user accessed LPA Sala Galdos with Finnair Platinum in Winter 2026.
 *
 * Rule for future batches: any oneworld lounge at a Finnair-network
 * airport gets AY in its carrier_restriction list, even if the current
 * oneworld.com snapshot doesn't show AY. See §36.
 *
 * PMI zone note:
 *   - Llevant Lounge is NON-Schengen (T3 non-Schengen sector).
 *   - Mediterraneo and Valldemosa are Schengen.
 *   A Schengen AY passenger from HEL → PMI reaches Mediterraneo &
 *   Valldemosa but NOT Llevant (physically_unreachable). This is the
 *   same pattern as CPH Eventyr (Phase 24).
 *
 * NOT added deliberately:
 *   amex_centurion — Amex Platinum reaches these via PP network channel
 *   opening_hours  — Aena's per-airport pages don't publish reliable
 *                    hours; all left NULL and tracked in §35
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results (per-airport pages, primary)
 *   https://www.aena.es (VIP Services pages, secondary — location + walk-in fee)
 *   https://www.prioritypass.com (PP network membership)
 *   User first-hand: LPA Sala Galdos access with AY Platinum, Winter 2026
 *
 * Idempotent: skips by (airport_id, name); each channel guarded by
 * (lounge_id, channel_type, alliance_access).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_AENA     = 'https://www.aena.es';
const SOURCE_PP       = 'https://www.prioritypass.com';

interface ChannelSpec {
  channelType:        string;
  allianceAccess:     'all_alliance' | 'carrier_specific' | null;
  minAllianceTier:    string | null;
  carrierRestriction: string[] | null;
  priority:           number;
  confidence:         number;
  sourceUrl:          string;
}

interface LoungeSpec {
  iata:                string;
  name:                string;
  locationDescription: string;
  tier:                'ultra_premium' | 'premium' | 'standard';
  loungeClass:         'first' | 'business' | 'standard';
  area:                'schengen' | 'non_schengen' | 'international' | 'all';
  openingHours:        string | null;
  amenities:           string[];
  channels:            ChannelSpec[];
}

// Standard Aena Sala VIP channel set. AY always included in oneworld
// carriers per file-level rule.
const AENA_CHANNELS = (carriers: string[]): ChannelSpec[] => [
  {
    channelType: 'alliance_status', allianceAccess: 'carrier_specific',
    minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers,
    priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD,
  },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_AENA },
];

const LOUNGES: LoungeSpec[] = [
  // ── PMI (Palma de Mallorca) — 3 lounges ────────────────────────────────
  {
    iata: 'PMI', name: 'Llevant Lounge',
    locationDescription: 'Non-Schengen — Terminal C, non-Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'non_schengen',
    openingHours: null,  // §35
    amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: AENA_CHANNELS(['AY', 'IB']),
  },
  {
    iata: 'PMI', name: 'Mediterraneo Lounge',
    locationDescription: 'Schengen — Terminal A, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null,  // §35
    amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: AENA_CHANNELS(['AY', 'IB']),
  },
  {
    iata: 'PMI', name: 'Valldemosa Lounge',
    locationDescription: 'Schengen — Terminal D, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null,  // §35
    amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: AENA_CHANNELS(['BA', 'AY', 'IB']),
  },

  // ── ALC (Alicante) — 1 lounge ──────────────────────────────────────────
  {
    iata: 'ALC', name: 'Costa Blanca Lounge',
    locationDescription: 'Schengen — Departures level, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null,  // §35
    amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: AENA_CHANNELS(['BA', 'AY', 'IB']),
  },

  // ── VLC (Valencia) — 1 lounge ──────────────────────────────────────────
  {
    iata: 'VLC', name: 'Joan Olivert Lounge',
    locationDescription: 'Schengen — Departures level, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null,  // §35
    amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: AENA_CHANNELS(['BA', 'AY', 'IB', 'AT']),
  },

  // ── LPA (Gran Canaria) — 1 lounge ──────────────────────────────────────
  {
    iata: 'LPA', name: 'Sala Galdos Lounge',
    locationDescription: 'Schengen — Departures level, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null,  // §35
    amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: AENA_CHANNELS(['BA', 'AY', 'IB', 'AT']),
  },
];

// Verify AT is seeded (required by VLC / LPA lounges)
const at = db.prepare(`SELECT id FROM airlines WHERE iata_code = 'AT'`).get() as { id: number } | undefined;
if (!at) {
  console.error('AT (Royal Air Maroc) not found in airlines — run patch-seed-at-ram.ts first');
  process.exit(1);
}

// Resolve airport ids up-front (fail fast if any missing)
const airportIds: Record<string, number> = {};
for (const iata of ['PMI', 'ALC', 'VLC', 'LPA']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) {
    console.error(`${iata} airport not found — aborting`);
    process.exit(1);
  }
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
      console.log(`  ✓ Inserted ${spec.iata} ${spec.name} (id=${loungeId}, area=${spec.area})`);
      loungesInserted++;
    }

    for (const ch of spec.channels) {
      const existingCh = db.prepare(`
        SELECT id FROM lounge_access_channels
        WHERE lounge_id = ? AND channel_type = ?
          AND (alliance_access IS ? OR alliance_access = ?)
      `).get(loungeId, ch.channelType, ch.allianceAccess, ch.allianceAccess) as { id: number } | undefined;

      if (existingCh) {
        console.log(`    ↩ ${ch.channelType}/${ch.allianceAccess ?? '—'}: exists — skipping`);
        channelsSkipped++;
        continue;
      }

      const chResult = db.prepare(`
        INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
        VALUES (?, ?, ?)
      `).run(loungeId, ch.channelType, ch.allianceAccess);

      db.prepare(`
        INSERT INTO lounge_access_rules
          (channel_id, min_alliance_tier, carrier_restriction,
           valid_from, valid_to, priority, confidence, conditions,
           source_url, verified_at)
        VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, NULL, ?, ?)
      `).run(
        chResult.lastInsertRowid,
        ch.minAllianceTier,
        ch.carrierRestriction ? JSON.stringify(ch.carrierRestriction) : null,
        ch.priority, ch.confidence, ch.sourceUrl, TODAY,
      );

      const carrierNote = ch.carrierRestriction ? ` [${ch.carrierRestriction.join(',')}]` : '';
      console.log(`    ✓ Added ${ch.channelType}${carrierNote} (priority ${ch.priority}, conf ${ch.confidence})`);
      channelsInserted++;
    }
  }

  console.log(`\nDone.  lounges: inserted=${loungesInserted} skipped=${loungesSkipped}  channels: inserted=${channelsInserted} skipped=${channelsSkipped}`);
  console.log(`Rule: AY in every carrier_restriction list — Finnair route network + seasonal oneworld.com snapshot (see §36).`);
})();

db.close();
