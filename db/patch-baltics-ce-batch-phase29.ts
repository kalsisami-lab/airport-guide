/**
 * Phase 29 (Batch 5): Seed 15 oneworld lounges across 9 Baltic and
 * Central European airports. Most complex batch — combines the WAW
 * carrier-list divergence (Phase 22 ARN Pearl T2/C37 shape) with the
 * BUD Schengen / non-Schengen split (Phase 24 CPH Eventyr shape) in a
 * single seed.
 *
 * New standard adopted this batch:
 *   Confidence on `alliance_status` rules varies per lounge:
 *     0.99 — carrier list matches oneworld.com snapshot as-is (direct)
 *     0.95 — carrier list is §36-derived (AY rule-added because
 *            oneworld.com's seasonal snapshot omitted AY)
 *   Prior batches (26/27/28) used uniform 0.95; not retro-updated.
 *   See §46 for the rule statement.
 *
 * No airline seed needed — all 5 referenced carriers (AA, AY, BA, IB,
 * QR) are already in the airlines table.
 *
 * Baltics (3 lounges, all AY-direct → 0.99):
 *   TLL Tallinn International Business Lounge   (id=63, schengen)  [AY]
 *   RIX Primeclass Business Lounge              (id=64, schengen)  [BA,AY]
 *   VNO Business Club Lounge                    (id=65, schengen)  [AY]
 *
 * Poland (5 lounges — WAW carrier-list divergence):
 *   WAW Etiuda Lounge                (id=66, schengen)  [BA,AY,QR]  §36 +AY  0.95
 *   WAW Fantazja Executive Lounge    (id=67, schengen)  [BA,AY,QR]  direct   0.99
 *   WAW Preludium Lounge             (id=68, schengen)  [AY,QR]     direct   0.99
 *   KRK Business Lounge Schengen     (id=69, schengen)  [BA,AY]     direct   0.99
 *   GDN Executive Lounge             (id=70, schengen)  [AY]        direct   0.99
 *
 *   WAW is the key case for this batch: a BA passenger reaches Etiuda
 *   and Fantazja (BA on their lists) but NOT Preludium (BA absent) —
 *   Preludium falls to paid_available via walk-in. This is the ARN
 *   Pearl T2/C37 divergence pattern applied to three lounges.
 *
 * Central Europe (7 lounges — BUD zone split):
 *   PRG Erste Premier Lounge (T2)          (id=71, schengen)     [AY,IB]        direct   0.99
 *   PRG Mastercard Lounge (T1)             (id=72, schengen)     [AA,BA,AY,QR]  §36 +AY  0.95
 *   BUD SkyCourt Lounge                    (id=73, schengen)     [AY,IB]        direct   0.99
 *   BUD Platinum Lounge Non-Schengen       (id=74, non_schengen) [AA,AY,QR]     §36 +AY  0.95
 *   BUD Platinum Lounge Schengen           (id=75, schengen)     [AY,QR]        §36 +AY  0.95
 *   BUD Plaza Premium Non-Schengen         (id=76, non_schengen) [BA,AY]        §36 +AY  0.95
 *   LJU Business Lounge                    (id=77, schengen)     [BA,AY,IB]     direct   0.99
 *
 *   BUD is the zone case: 2 Schengen + 2 non-Schengen at the same
 *   airport. A Finnair HEL→BUD (Schengen) passenger reaches SkyCourt
 *   and Platinum Schengen (both Schengen, both have AY) but not the
 *   two non-Schengen lounges (physically_unreachable regardless of
 *   whether §36 added AY to their carrier lists — the zone filter
 *   fires before the carrier check).
 *
 * Confidence split totals: 10 direct-0.99, 5 §36-derived-0.95.
 *
 * NOT added deliberately:
 *   PRG Menzies Aviation Lounge  — temporarily closed; deferred (§44)
 *   amex_centurion               — Amex Platinum reaches these via PP
 *   opening_hours                — operator sites don't publish reliably;
 *                                  all NULL, tracked in §43
 *   terminal_id                  — engine has no terminal filter path
 *                                  today; PRG T1/T2 recorded only in
 *                                  location_description (§45)
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results (per-airport pages, primary)
 *   https://www.prioritypass.com (PP network membership)
 *   Airport operator sites: tallinn-airport.ee, riga-airport.com,
 *                          vno.lt, lotnisko-chopina.pl, budapestairport.com,
 *                          prg.aero, lju-airport.si
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
const SOURCE_OPERATOR = 'https://www.oneworld.com/airport-lounge-results';  // per-airport operator varies; use oneworld as canonical for the paid channel too
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

// Standard 5-channel set with per-lounge alliance_status confidence.
// New in Phase 29 (see §46): 0.99 direct-listed vs 0.95 §36-derived.
const STANDARD_CHANNELS = (carriers: string[], allianceConfidence: 0.95 | 0.99): ChannelSpec[] => [
  {
    channelType: 'alliance_status', allianceAccess: 'carrier_specific',
    minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers,
    priority: 100, confidence: allianceConfidence, sourceUrl: SOURCE_ONEWORLD,
  },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_OPERATOR },
];

const LOUNGES: LoungeSpec[] = [
  // ── BALTICS (all direct → 0.99) ──────────────────────────────────────────
  {
    iata: 'TLL', name: 'Tallinn International Business Lounge',
    locationDescription: 'Schengen — Main Terminal, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['AY'], 0.99),
  },
  {
    iata: 'RIX', name: 'Primeclass Business Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['BA', 'AY'], 0.99),
  },
  {
    iata: 'VNO', name: 'Business Club Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['AY'], 0.99),
  },

  // ── POLAND — WAW carrier divergence ──────────────────────────────────────
  {
    iata: 'WAW', name: 'Etiuda Lounge',
    locationDescription: 'Schengen — Terminal A, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['BA', 'AY', 'QR'], 0.95),  // §36 +AY
  },
  {
    iata: 'WAW', name: 'Fantazja Executive Lounge',
    locationDescription: 'Schengen — Terminal A, Schengen boarding area',
    tier: 'premium', loungeClass: 'business', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    channels: STANDARD_CHANNELS(['BA', 'AY', 'QR'], 0.99),
  },
  {
    iata: 'WAW', name: 'Preludium Lounge',
    locationDescription: 'Schengen — Terminal A, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['AY', 'QR'], 0.99),
  },
  {
    iata: 'KRK', name: 'Business Lounge Schengen',
    locationDescription: 'Schengen — Departures level, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['BA', 'AY'], 0.99),
  },
  {
    iata: 'GDN', name: 'Executive Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['AY'], 0.99),
  },

  // ── CENTRAL EUROPE — PRG (2 lounges) + BUD (4 lounges, zone split) + LJU ─
  {
    iata: 'PRG', name: 'Erste Premier Lounge',
    locationDescription: 'Schengen — Terminal 2, Schengen boarding area (§45: terminal not filtered by engine)',
    tier: 'premium', loungeClass: 'business', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    channels: STANDARD_CHANNELS(['AY', 'IB'], 0.99),
  },
  {
    iata: 'PRG', name: 'Mastercard Lounge',
    locationDescription: 'Schengen — Terminal 1, non-EU/Schengen departures (§45: terminal not filtered by engine)',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['AA', 'BA', 'AY', 'QR'], 0.95),  // §36 +AY
  },
  {
    iata: 'BUD', name: 'SkyCourt Lounge',
    locationDescription: 'Schengen — Terminal 2A, SkyCourt central atrium',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['AY', 'IB'], 0.99),
  },
  {
    iata: 'BUD', name: 'Platinum Lounge Non-Schengen',
    locationDescription: 'Non-Schengen — Terminal 2B, non-Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'non_schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['AA', 'AY', 'QR'], 0.95),  // §36 +AY
  },
  {
    iata: 'BUD', name: 'Platinum Lounge Schengen',
    locationDescription: 'Schengen — Terminal 2A, Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['AY', 'QR'], 0.95),  // §36 +AY
  },
  {
    iata: 'BUD', name: 'Plaza Premium Non-Schengen',
    locationDescription: 'Non-Schengen — Terminal 2B, non-Schengen boarding area',
    tier: 'standard', loungeClass: 'standard', area: 'non_schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['BA', 'AY'], 0.95),  // §36 +AY
  },
  {
    iata: 'LJU', name: 'Business Lounge',
    locationDescription: 'Schengen — Departures level, airside',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: STANDARD_CHANNELS(['BA', 'AY', 'IB'], 0.99),
  },
];

// Resolve airport ids up-front (fail fast if any missing)
const airportIds: Record<string, number> = {};
for (const iata of ['TLL', 'RIX', 'VNO', 'WAW', 'KRK', 'GDN', 'PRG', 'BUD', 'LJU']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) {
    console.error(`${iata} airport not found — aborting`);
    process.exit(1);
  }
  airportIds[iata] = row.id;
}

db.transaction(() => {
  let loungesInserted = 0, loungesSkipped = 0, channelsInserted = 0, channelsSkipped = 0;
  let directCount = 0, derivedCount = 0;

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
      const allianceCh = spec.channels.find(c => c.channelType === 'alliance_status');
      const confLabel = allianceCh?.confidence === 0.99 ? 'direct' : '§36';
      if (allianceCh?.confidence === 0.99) directCount++; else derivedCount++;
      console.log(`  ✓ Inserted ${spec.iata} ${spec.name} (id=${loungeId}, area=${spec.area}, conf=${allianceCh?.confidence} ${confLabel})`);
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
  console.log(`Confidence split (new in Phase 29 per §46): ${directCount} direct-0.99, ${derivedCount} §36-derived-0.95.`);
})();

db.close();
