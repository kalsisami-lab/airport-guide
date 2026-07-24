/**
 * Seed DEL + TLV from existing scrape output (scripts/output/oneworld-lounges.json).
 *
 * Both airports were already in the scraper input (scripts/iatas.txt) and
 * appeared in the scrape output — but the earlier seed batches (3a East
 * Asia, 3b Southern Europe, 3c Central+Western Europe, 3d Nordic, 3e
 * Americas, 3f MEL+odd) never targeted them. This patch closes the
 * "scraped but never seeded" gap identified in §66.
 *
 * Provenance: source_url captured per rule (oneworld.com scrape page +
 * scrape JSON path), verified_at = 2026-07-24.
 *
 * Rules seeded (all Ryhmä 1, standard 5-channel model: carrier_specific +
 * PP + LK + DP + paid, area='all', tier_semantics N/A for lounges):
 *
 *   DEL — Encalm Prive Lounge (T3, Level 3, 24h)
 *     Carriers: [BA, CX, AY, JL, WY, QR] — AY already listed, no §36
 *     Ryhmä 1: third-party operator name, "THESE only" implicit
 *
 *   TLV — Dan Lounge (T1, 24h)
 *     Carriers: [AT] + §36 AY = [AT, AY]
 *     Ryhmä 1
 *
 *   TLV — Layam Lounge - Pier C (T3, Concourse C beside gates C1-C2, 24h)
 *     Carriers: [BA, IB] + §36 AY = [BA, IB, AY]
 *     Ryhmä 1
 *
 * Idempotent per (airport_id, name).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = '2026-07-24';

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_PP       = 'https://www.prioritypass.com';
const SOURCE_ENCALM   = 'https://encalm.com';
const SOURCE_DAN      = 'https://www.dan.co.il';
const SOURCE_LAYAM    = 'https://www.layamlounges.com';
const SOURCE_SCRAPE   = 'scripts/output/oneworld-lounges.json@2026-07';

interface ChannelSpec {
  channelType: string; allianceAccess: 'all_alliance' | 'carrier_specific' | null;
  minAllianceTier: string | null; carrierRestriction: string[] | null;
  priority: number; confidence: number; sourceUrl: string;
}

interface LoungeSpec {
  iata: string; name: string; locationDescription: string;
  openingHours: string | null;
  channels: ChannelSpec[];
}

const RYHMA_1_CHANNELS = (carriers: string[], operatorSource: string): ChannelSpec[] => [
  { channelType: 'alliance_status', allianceAccess: 'carrier_specific', minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, priority: 100, confidence: 0.95, sourceUrl: `${SOURCE_ONEWORLD} + ${SOURCE_SCRAPE}` },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: operatorSource },
];

const HOURS_24H = JSON.stringify({
  Sunday: ['00:00 - 23:59'], Monday: ['00:00 - 23:59'], Tuesday: ['00:00 - 23:59'],
  Wednesday: ['00:00 - 23:59'], Thursday: ['00:00 - 23:59'],
  Friday: ['00:00 - 23:59'], Saturday: ['00:00 - 23:59'],
});
const PREMIUM_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const LOUNGES: LoungeSpec[] = [
  {
    iata: 'DEL', name: 'Encalm Prive Lounge',
    locationDescription: 'Terminal 3, Level 3, after security',
    openingHours: HOURS_24H,
    // AY already on list — no §36 addition
    channels: RYHMA_1_CHANNELS(['BA', 'CX', 'AY', 'JL', 'WY', 'QR'], SOURCE_ENCALM),
  },
  {
    iata: 'TLV', name: 'Dan Lounge',
    locationDescription: 'Terminal 1, after security',
    openingHours: HOURS_24H,
    // §36: AT-only → [AT, AY]
    channels: RYHMA_1_CHANNELS(['AT', 'AY'], SOURCE_DAN),
  },
  {
    iata: 'TLV', name: 'Layam Lounge - Pier C',
    locationDescription: 'International Terminal 3, Concourse C, beside Gates C1-C2, after security',
    openingHours: HOURS_24H,
    // §36: [BA, IB] → [BA, IB, AY]
    channels: RYHMA_1_CHANNELS(['BA', 'IB', 'AY'], SOURCE_LAYAM),
  },
];

const airportIds: Record<string, number> = {};
for (const iata of ['DEL', 'TLV']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) { console.error(`${iata} airport not found`); process.exit(1); }
  airportIds[iata] = row.id;
}

db.transaction(() => {
  let lI = 0, lS = 0, cI = 0, cS = 0;
  for (const spec of LOUNGES) {
    const airportId = airportIds[spec.iata];
    let loungeId: number;
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;

    if (existing) {
      loungeId = existing.id;
      console.log(`  ↩ ${spec.iata} ${spec.name}: id=${loungeId} — skip`);
      lS++;
    } else {
      const result = db.prepare(`
        INSERT INTO lounges (airport_id, terminal_id, name, location_description,
          tier, lounge_class, area, opening_hours, amenities)
        VALUES (?, NULL, ?, ?, 'premium', 'business', 'all', ?, ?)
      `).run(airportId, spec.name, spec.locationDescription, spec.openingHours, JSON.stringify(PREMIUM_AMENITIES));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.iata} ${spec.name} (id=${loungeId}, 24h)`);
      lI++;
    }

    for (const ch of spec.channels) {
      const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = ? AND (alliance_access IS ? OR alliance_access = ?)`)
        .get(loungeId, ch.channelType, ch.allianceAccess, ch.allianceAccess) as { id: number } | undefined;
      if (existingCh) { cS++; continue; }
      const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, ?, ?)`)
        .run(loungeId, ch.channelType, ch.allianceAccess);
      db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, NULL, ?, ?)`)
        .run(chResult.lastInsertRowid, ch.minAllianceTier,
          ch.carrierRestriction ? JSON.stringify(ch.carrierRestriction) : null,
          ch.priority, ch.confidence, ch.sourceUrl, TODAY);
      cI++;
    }
  }
  console.log(`\nDone. lounges: inserted=${lI} skipped=${lS}, channels: inserted=${cI} skipped=${cS}`);
})();

db.close();
