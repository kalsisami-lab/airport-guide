/**
 * Phase 32 (Batch 3d): Seed 4 Ryhmä 1 third-party Nordic lounges.
 *
 * Small batch — only 4 airports in the Nordic bucket that have a
 * third-party oneworld lounge on oneworld.com/airport-lounge-results:
 *
 *   BLL  (Billund)   1  King Amlet Lounge
 *   BGO  (Bergen)    1  Bergen Lounge
 *   KEF  (Reykjavik) 1  Icelandair Saga Lounge
 *   SVG  (Stavanger) 1  North Sea Lounge
 *
 * §36 note: 3 of 4 lounges already list AY directly (Bergen, Saga, North
 * Sea). BLL King Amlet appears in the scrape as two near-duplicate entries
 * ("King Amlet" [AY] and "King Amlet Lounge" [BA]) — same physical lounge,
 * different snapshot rows. Seeded once with the union list [AY, BA]. Zero
 * §36 cases as a result — this batch is entirely positive-control from
 * §36's perspective, useful as a regression that §36 tests don't leak into
 * regions where AY is already listed by the operator.
 *
 * Zone: all Schengen countries (Denmark, Norway is EEA/Schengen for
 * air, Iceland is EEA/Schengen). Scrape doesn't specify zones for any of
 * these — use area='all' consistently.
 *
 * No new carriers (AS, AA, BA, IB, AY already seeded).
 *
 * NOT included:
 *   GOT (Gothenburg) — 1 scraped lounge [BA,AY], deferrable if scope
 *     needs to stay tight. Add in a follow-up combined-nordic batch.
 *   TRD/TOS/BOO/KKN — Ryhmä 4 (PP-only) airports, out of scope for
 *     autonomous Ryhmä 1 seeding per user rules.
 *
 * Sources: oneworld.com/airport-lounge-results, icelandair.com/saga-lounge,
 * plazapremiumlounge.com, avinor.no (BGO/SVG operator), bll.dk (BLL operator).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_PP       = 'https://www.prioritypass.com';
const SOURCE_SAGA     = 'https://www.icelandair.com/en/travel-info/saga-lounge/';
const SOURCE_AVINOR   = 'https://avinor.no';
const SOURCE_BLL      = 'https://www.bll.dk';

interface ChannelSpec { channelType: string; allianceAccess: 'all_alliance' | 'carrier_specific' | null; minAllianceTier: string | null; carrierRestriction: string[] | null; priority: number; confidence: number; sourceUrl: string; }
interface LoungeSpec { iata: string; name: string; locationDescription: string; tier: 'ultra_premium' | 'premium' | 'standard'; loungeClass: 'first' | 'business' | 'standard'; area: 'schengen' | 'non_schengen' | 'international' | 'all'; openingHours: string | null; amenities: string[]; channels: ChannelSpec[]; }

const RYHMA_1_CHANNELS = (carriers: string[], operatorSource: string): ChannelSpec[] => [
  { channelType: 'alliance_status', allianceAccess: 'carrier_specific', minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: operatorSource },
];

const STANDARD = ['Buffet', 'Bar', 'WiFi', 'Workspace'];
const PREMIUM  = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const LOUNGES: LoungeSpec[] = [
  { iata: 'BLL', name: 'King Amlet Lounge', locationDescription: 'International Departures, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['AY', 'BA'], SOURCE_BLL) },  // union of scrape dupes ["King Amlet"→AY, "King Amlet Lounge"→BA]
  { iata: 'BGO', name: 'Bergen Lounge', locationDescription: 'Departure terminal, near Gate 26, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['AY', 'IB'], SOURCE_AVINOR) },
  { iata: 'KEF', name: 'Icelandair Saga Lounge', locationDescription: 'Top floor between Gates A and C, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AS', 'AA', 'BA', 'AY'], SOURCE_SAGA) },
  { iata: 'SVG', name: 'North Sea Lounge', locationDescription: 'Main terminal, between Gates 11 and 12, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['AY'], SOURCE_AVINOR) },
];

const airportIds: Record<string, number> = {};
for (const iata of ['BLL','BGO','KEF','SVG']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) { console.error(`${iata} airport not found — aborting`); process.exit(1); }
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
      const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`)
        .run(airportId, spec.name, spec.locationDescription, spec.tier, spec.loungeClass, spec.area, spec.openingHours, JSON.stringify(spec.amenities));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.iata} ${spec.name} (id=${loungeId})`);
      lI++;
    }
    for (const ch of spec.channels) {
      const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = ? AND (alliance_access IS ? OR alliance_access = ?)`)
        .get(loungeId, ch.channelType, ch.allianceAccess, ch.allianceAccess) as { id: number } | undefined;
      if (existingCh) { cS++; continue; }
      const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, ?, ?)`)
        .run(loungeId, ch.channelType, ch.allianceAccess);
      db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, NULL, ?, ?)`)
        .run(chResult.lastInsertRowid, ch.minAllianceTier, ch.carrierRestriction ? JSON.stringify(ch.carrierRestriction) : null, ch.priority, ch.confidence, ch.sourceUrl, TODAY);
      cI++;
    }
  }
  console.log(`\nDone.  lounges: inserted=${lI} skipped=${lS}  channels: inserted=${cI} skipped=${cS}`);
})();
db.close();
