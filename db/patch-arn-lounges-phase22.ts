/**
 * Phase 22: Add Stockholm-Arlanda (ARN) lounges.
 *
 * ARN is the second oneworld hub added to the database (Phase 20 seeded ARN
 * into airports but with no lounges). Three lounges added; a fourth (60°
 * Lounge, non-Schengen F67) deferred to §23 pending access-rule confirmation.
 *
 * Lounges:
 *   A. Pearl Lounge Terminal 2 — Schengen, Plaza Premium contract lounge
 *      oneworld carrier-restricted to ['BA','AY','IB'] per oneworld.com
 *   B. Pearl Lounge Gate C37    — Schengen, Plaza Premium contract lounge
 *      oneworld carrier-restricted to ['BA','QR'] per oneworld.com (DIFFERS from T2)
 *   C. American Express Lounge  — Schengen, network-exclusive (Amex Platinum/Centurion only)
 *
 * The T2/C37 carrier-list divergence is the precision-critical detail: an AY
 * (Finnair) passenger with oneworld Sapphire status is `allowed` at Pearl T2
 * but falls to `paid_available` at Pearl C37 (AY not in C37's carrier list).
 *
 * Sources:
 *   oneworld.com/airport-lounge-results?location=ARN (primary — carrier lists)
 *   swedavia.com/arlanda/service/pearl-lounge32/ (C37 opening hours)
 *   loungepair.com/guides/guide-pearl-lounges-stockholm-arlanda-airport/ (secondary)
 *
 * Idempotent: skips by (airport_id, name); each channel guarded by
 * (lounge_id, channel_type, alliance_access).
 *
 * Uses raw better-sqlite3 per project convention for DB patches.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results?location=ARN';
const SOURCE_SWEDAVIA = 'https://www.swedavia.com/arlanda/service/';
const SOURCE_LOUNGEPAIR = 'https://www.loungepair.com/guides/guide-pearl-lounges-stockholm-arlanda-airport/';

interface ChannelSpec {
  channelType:      string;
  allianceAccess:   'all_alliance' | 'carrier_specific' | null;
  minAllianceTier:  string | null;
  carrierRestriction: string[] | null;
  priority:         number;
  confidence:       number;
  sourceUrl:        string;
}

interface LoungeSpec {
  name:                string;
  locationDescription: string;
  tier:                'ultra_premium' | 'premium' | 'standard';
  loungeClass:         'first' | 'business' | 'standard';
  area:                'schengen' | 'non_schengen' | 'international' | 'all';
  openingHours:        string | null;
  amenities:           string[];
  channels:            ChannelSpec[];
}

const PEARL_COMMON_CHANNELS = (carriers: string[]): ChannelSpec[] => [
  {
    channelType: 'alliance_status', allianceAccess: 'carrier_specific',
    minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers,
    priority: 100, confidence: 0.99, sourceUrl: SOURCE_ONEWORLD,
  },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9, sourceUrl: SOURCE_LOUNGEPAIR },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9, sourceUrl: SOURCE_LOUNGEPAIR },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9, sourceUrl: SOURCE_LOUNGEPAIR },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9, sourceUrl: SOURCE_LOUNGEPAIR },
];

const LOUNGES: LoungeSpec[] = [
  {
    name:                'Pearl Lounge Terminal 2',
    locationDescription: "Schengen — Terminal 2, airside (4th floor, O'Learys area)",
    tier:                'standard',
    loungeClass:         'standard',
    area:                'schengen',
    openingHours:        null,  // TODO §25 — Swedavia does not list hours for T2
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    channels:            PEARL_COMMON_CHANNELS(['BA', 'AY', 'IB']),
  },
  {
    name:                'Pearl Lounge Gate C37',
    locationDescription: 'Schengen — Gate C37, Terminal 4',
    tier:                'standard',
    loungeClass:         'standard',
    area:                'schengen',
    openingHours:        'Daily 06:30–20:30',
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    channels:            PEARL_COMMON_CHANNELS(['BA', 'QR']),
  },
  {
    name:                'American Express Lounge',
    locationDescription: 'Schengen — Terminal 5, Marketplace between gates E and F',
    tier:                'premium',
    loungeClass:         'business',
    area:                'schengen',
    openingHours:        'Daily 05:00–19:30',
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: [
      // amex_centurion covers both Amex Centurion and Amex Platinum
      // (UI hooks/useEntitlements.ts maps 'amex-platinum' → 'amex_centurion').
      { channelType: 'amex_centurion', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9, sourceUrl: SOURCE_SWEDAVIA },
    ],
  },
];

db.transaction(() => {
  const arn = db.prepare(`SELECT id FROM airports WHERE iata_code = 'ARN'`).get() as { id: number } | undefined;
  if (!arn) {
    console.error('ARN airport not found — aborting');
    process.exit(1);
  }

  let loungesInserted = 0, loungesSkipped = 0, channelsInserted = 0, channelsSkipped = 0;

  for (const spec of LOUNGES) {
    let loungeId: number;
    const existing = db.prepare(`
      SELECT id FROM lounges WHERE airport_id = ? AND name = ?
    `).get(arn.id, spec.name) as { id: number } | undefined;

    if (existing) {
      loungeId = existing.id;
      console.log(`  ↩ ${spec.name}: already in DB (id=${loungeId}) — skipping lounge insert`);
      loungesSkipped++;
    } else {
      const result = db.prepare(`
        INSERT INTO lounges
          (airport_id, terminal_id, name, location_description,
           tier, lounge_class, area, opening_hours, amenities)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        arn.id, spec.name, spec.locationDescription, spec.tier, spec.loungeClass,
        spec.area, spec.openingHours, JSON.stringify(spec.amenities),
      );
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ Inserted ${spec.name} (id=${loungeId})`);
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
})();

db.close();
