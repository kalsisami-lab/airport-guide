/**
 * Phase 28 (Batch 4): Seed 13 oneworld lounges across 12 Portuguese and
 * Italian airports — largest single-batch seed to date.
 *
 * Extends the Phase 26 (Spain) / Phase 27 (Greece) Aena/Goldair model
 * unchanged: oneworld carrier_specific + PP/LK/DP + walk-in paid, no
 * amex_centurion (PP covers Amex Platinum). §36 rule applied throughout
 * (AY in every carrier list).
 *
 * All 12 airports were seeded in Phase 20 (Finnair network). All 6
 * carriers referenced (AA, AT, AY, BA, IB, QR) are already in the
 * airlines table — no airline seed needed this batch. AA joined
 * oneworld at founding (1999); AT joined 2020-04-01 (seeded Phase 26).
 *
 * Portugal (5 lounges, 4 airports):
 *   LIS ANA Lounge                (id=50, schengen)       hub — 6 carriers
 *   OPO ANA Lounge                (id=51, schengen)       §36 +AY
 *   FAO CIP Lounge                (id=52, NON-SCHENGEN)   §36 +AY
 *   FAO CIP Lounge Schengen       (id=53, schengen)       §36 +AY
 *   FNC ANA Airport Lounge        (id=54, schengen)       §36 +AY
 *
 * Italy (8 lounges, 8 airports):
 *   NAP Pearl Lounge              (id=55, schengen)
 *   VCE Venice Marco Polo Lounge  (id=56, schengen)       hub — 6 carriers
 *   BLQ Prima Vista Lounge        (id=57, schengen)
 *   PSA Sala VIP Galilei          (id=58, schengen)       §36 +AY
 *   FLR Aeroporti VIP Club        (id=59, schengen)
 *   CTA Angelo D'Arrigo           (id=60, schengen)       small [AY,IB]
 *   VRN Catullo Lounge by Aspire  (id=61, schengen)       small [AY,IB]
 *   TRN Piemonte Lounge           (id=62, schengen)
 *
 * FAO zone split (new pattern for this batch):
 *   FAO is the first Portuguese/Italian airport with a Schengen/non-
 *   Schengen lounge split within the same airport — same shape as CPH
 *   Eventyr (Phase 24) and PMI Llevant (Phase 26). A Finnair passenger
 *   on a Schengen departure from FAO reaches CIP Lounge Schengen but
 *   NOT CIP Lounge (non_schengen).
 *
 *   The CIP Lounge (non_schengen) zone assignment is an assumption —
 *   inferred from the fact that a separate "CIP Lounge Schengen" exists
 *   under the same operator, so the base "CIP Lounge" is presumed to
 *   serve non-Schengen departures. Verify on-site (see §41).
 *
 * Name collisions handled by the (airport_id, name) unique constraint:
 *   "ANA Lounge"          → LIS + OPO (2 rows, different airport_ids)
 *   "Pearl Lounge"        → NAP now + ARN T2/C37 from Phase 22
 *   "Prima Vista Lounge"  → BLQ + SKG from Phase 27
 *
 * NOT added deliberately:
 *   LIS Blue Lounge       — PP-only, no oneworld; deferred to a PP-only
 *                           batch following AGP Sala VIP shape (§42)
 *   amex_centurion        — Amex Platinum reaches these via PP
 *   opening_hours         — operator sites (ANA, Aspire, local operators)
 *                           don't publish reliably; all NULL, tracked §40
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results (per-airport pages, with §36 correction)
 *   https://www.ana.pt (ANA Aeroportos de Portugal — LIS, OPO, FAO, FNC)
 *   https://www.aeroportidipuglia.it and airport operator sites (Italy)
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

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_ANA      = 'https://www.ana.pt';
const SOURCE_ITALY    = 'https://www.oneworld.com/airport-lounge-results';  // per-airport operator varies; use oneworld as canonical
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
  operatorSource:      string;
  channels:            ChannelSpec[];
}

// Standard 5-channel set — mirrors AENA_CHANNELS (Phase 26) and
// GREEK_CHANNELS (Phase 27). AY always in oneworld list per §36.
const STANDARD_CHANNELS = (carriers: string[], operatorSource: string): ChannelSpec[] => [
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
  // ── PORTUGAL ────────────────────────────────────────────────────────────
  {
    iata: 'LIS', name: 'ANA Lounge',
    locationDescription: 'Schengen — Terminal 1, airside',
    tier: 'premium', loungeClass: 'business', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    operatorSource: SOURCE_ANA,
    channels: STANDARD_CHANNELS(['AA', 'BA', 'AY', 'IB', 'QR', 'AT'], SOURCE_ANA),
  },
  {
    iata: 'OPO', name: 'ANA Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ANA,
    channels: STANDARD_CHANNELS(['BA', 'AY', 'IB', 'AT'], SOURCE_ANA),
  },
  {
    iata: 'FAO', name: 'CIP Lounge',
    locationDescription: 'Non-Schengen — Departures level, non-Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'non_schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ANA,
    channels: STANDARD_CHANNELS(['BA', 'AY'], SOURCE_ANA),
  },
  {
    iata: 'FAO', name: 'CIP Lounge Schengen',
    locationDescription: 'Schengen — Departures level, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ANA,
    channels: STANDARD_CHANNELS(['AY', 'IB'], SOURCE_ANA),
  },
  {
    iata: 'FNC', name: 'ANA Airport Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ANA,
    channels: STANDARD_CHANNELS(['BA', 'AY', 'IB'], SOURCE_ANA),
  },

  // ── ITALY ───────────────────────────────────────────────────────────────
  {
    iata: 'NAP', name: 'Pearl Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ITALY,
    channels: STANDARD_CHANNELS(['BA', 'AY', 'IB', 'AT'], SOURCE_ITALY),
  },
  {
    iata: 'VCE', name: 'Venice Marco Polo Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'premium', loungeClass: 'business', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    operatorSource: SOURCE_ITALY,
    channels: STANDARD_CHANNELS(['AA', 'BA', 'AY', 'IB', 'QR', 'AT'], SOURCE_ITALY),
  },
  {
    iata: 'BLQ', name: 'Prima Vista Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ITALY,
    channels: STANDARD_CHANNELS(['AA', 'BA', 'AY', 'IB', 'AT'], SOURCE_ITALY),
  },
  {
    iata: 'PSA', name: 'Sala VIP Galilei',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ITALY,
    channels: STANDARD_CHANNELS(['BA', 'AY', 'QR'], SOURCE_ITALY),
  },
  {
    iata: 'FLR', name: 'Aeroporti VIP Club',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ITALY,
    channels: STANDARD_CHANNELS(['BA', 'AY', 'IB'], SOURCE_ITALY),
  },
  {
    iata: 'CTA', name: "Angelo D'Arrigo",
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ITALY,
    channels: STANDARD_CHANNELS(['AY', 'IB'], SOURCE_ITALY),
  },
  {
    iata: 'VRN', name: 'Catullo Lounge by Aspire',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ITALY,
    channels: STANDARD_CHANNELS(['AY', 'IB'], SOURCE_ITALY),
  },
  {
    iata: 'TRN', name: 'Piemonte Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    operatorSource: SOURCE_ITALY,
    channels: STANDARD_CHANNELS(['BA', 'AY', 'IB', 'AT'], SOURCE_ITALY),
  },
];

// Resolve airport ids up-front (fail fast if any missing)
const airportIds: Record<string, number> = {};
for (const iata of ['LIS', 'OPO', 'FAO', 'FNC', 'NAP', 'VCE', 'BLQ', 'PSA', 'FLR', 'CTA', 'VRN', 'TRN']) {
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
  console.log(`§36 rule applied. FAO zone split (CIP Lounge non_schengen / CIP Lounge Schengen schengen) — CPH-style physically_unreachable filter.`);
})();

db.close();
