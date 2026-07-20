/**
 * Phase 27 (Batch 2): Seed 6 oneworld lounges across 5 Greek airports.
 *
 * Mechanical extension of Phase 26 (Spain Batch 1) to the Finnair-network
 * Greek destinations, operated by Goldair Handling and Skyserv. Same
 * channel shape as Aena Sala VIP: oneworld carrier_specific + PP/LK/DP
 * + walk-in paid, no amex_centurion (Amex Platinum reaches these via
 * the PP network).
 *
 * All lounges are Schengen — Greece joined Schengen in 2000; no
 * intra-airport zone split here (contrast PMI Llevant in Phase 26).
 *
 * Airports (all seeded Phase 20, IDs 85–92):
 *   CFU (Corfu)         — Goldair Handling Lounge
 *   HER (Heraklion)     — Filoxenia Lounge
 *   RHO (Rhodes)        — Goldair Handling Lounge
 *                         (Skyserv Lounge RHO temporarily closed — see §39)
 *   JMK (Mykonos)       — CIP Lounge by Goldair
 *   SKG (Thessaloniki)  — Manolis Andronikos Skyserv Lounge + Prima Vista Lounge
 *
 * §36 seasonal-snapshot correction — this batch is where the rule pays off:
 * -----------------------------------------------------------------------
 * oneworld.com's per-airport snapshots for CFU and RHO show ONLY British
 * Airways in the carrier list, because those pages were queried in summer
 * 2026 when Finnair's Greek summer schedule wasn't visible for those
 * dates. Finnair (AY) demonstrably flies CFU and RHO on summer schedule
 * (same as the LPA Winter 2026 case that motivated §36). Rule applied
 * unchanged: AY is added to every carrier_restriction list here.
 *
 * SKG is the positive control — oneworld.com lists Finnair directly for
 * Manolis Andronikos Skyserv Lounge, so `[AY]` alone matches both the
 * snapshot and the §36-derived list. Same source, same result — the rule
 * is not silently over-including AY when it's already there.
 *
 * All alliance_status rules use confidence 0.95 (rule-derived) per §36.
 *
 * NOT added deliberately:
 *   RHO Skyserv Lounge   — temporarily closed (§39a)
 *   JTR / KGS / CHQ      — Santorini/Kos/Chania have no oneworld lounge on
 *                          oneworld.com; possibly PP-only, deferred to a
 *                          separate batch (§39b)
 *   amex_centurion       — Amex Platinum reaches these via PP
 *   opening_hours        — Goldair/Skyserv operator sites don't publish
 *                          reliable hours; all NULL, tracked in §38
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results (per-airport pages, primary)
 *   https://www.goldair-handling.gr (operator — CFU, RHO, JMK, HER)
 *   https://www.skyserv.aero (operator — SKG Manolis Andronikos + Prima Vista)
 *   https://www.prioritypass.com (PP network membership)
 *
 * Idempotent: skips by (airport_id, name); each channel guarded by
 * (lounge_id, channel_type, alliance_access).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD  = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_GOLDAIR   = 'https://www.goldair-handling.gr';
const SOURCE_SKYSERV   = 'https://www.skyserv.aero';
const SOURCE_PP        = 'https://www.prioritypass.com';

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
  operatorSource:      string;
  channels:            ChannelSpec[];
}

// Standard Goldair/Skyserv channel set — mirrors AENA_CHANNELS in Phase 26.
// AY always included per §36.
const GREEK_CHANNELS = (carriers: string[], operatorSource: string): ChannelSpec[] => [
  {
    channelType: 'alliance_status', allianceAccess: 'carrier_specific',
    minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers,
    priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD,
  },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: operatorSource },
];

const LOUNGES: LoungeSpec[] = [
  {
    iata: 'CFU', name: 'Goldair Handling Lounge',
    locationDescription: 'Schengen — Main Terminal, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_GOLDAIR,
    channels: GREEK_CHANNELS(['BA', 'AY'], SOURCE_GOLDAIR),
  },
  {
    iata: 'HER', name: 'Filoxenia Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_GOLDAIR,
    channels: GREEK_CHANNELS(['BA', 'AY', 'IB'], SOURCE_GOLDAIR),
  },
  {
    iata: 'RHO', name: 'Goldair Handling Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_GOLDAIR,
    channels: GREEK_CHANNELS(['BA', 'AY'], SOURCE_GOLDAIR),
  },
  {
    iata: 'JMK', name: 'CIP Lounge by Goldair',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_GOLDAIR,
    channels: GREEK_CHANNELS(['AY', 'IB', 'QR'], SOURCE_GOLDAIR),
  },
  {
    iata: 'SKG', name: 'Manolis Andronikos Skyserv Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_SKYSERV,
    // Positive control for §36: oneworld.com lists AY directly here.
    channels: GREEK_CHANNELS(['AY'], SOURCE_SKYSERV),
  },
  {
    iata: 'SKG', name: 'Prima Vista Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_SKYSERV,
    channels: GREEK_CHANNELS(['BA', 'AY'], SOURCE_SKYSERV),
  },
];

// Resolve airport ids up-front (fail fast if any missing)
const airportIds: Record<string, number> = {};
for (const iata of ['CFU', 'HER', 'RHO', 'JMK', 'SKG']) {
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
  console.log(`§36 rule applied: AY in every carrier_restriction list (SKG Manolis Andronikos is the positive control — oneworld.com lists AY directly).`);
})();

db.close();
