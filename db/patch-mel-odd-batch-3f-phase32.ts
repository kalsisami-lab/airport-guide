/**
 * Phase 32 (Batch 3f): Seed 7 Ryhmä 1 lounges — MEL + odd/leisure airports.
 *
 * Final Ryhmä 1 batch from the current scrape output. Covers the tail
 * airports that don't cluster into any single region:
 *
 *   MEL  2  Marhaba Business Lounge · Marhaba Lounge
 *   HKT  2  The Coral Executive Lounge · The Coral First Class Lounge
 *   AYT  1  CIP Lounge (Antalya, TR)
 *   GOT  1  The Lounge by Menzies Aviation (Gothenburg, SE — Schengen)
 *   XIY  1  First Class Lounge (Xi'an, CN)
 *
 * Same 5-channel Ryhmä 1 model. §36 AY-lisäys applied to 5 lounges.
 * All AY targets are Finnair-network hubs (MEL via QF codeshare from
 * SIN/HKG, HKT via seasonal charter, AYT via seasonal AY charter, GOT
 * via AY511/etc., XIY via CX codeshare).
 *
 * §36 targets (5):
 *   MEL Marhaba Business  [QR]        → [QR,AY]
 *   MEL Marhaba Lounge    [MH]        → [MH,AY]
 *   HKT Coral First       [CX]        → [CX,AY]
 *   AYT CIP Lounge        [BA,QR]     → [BA,QR,AY]
 *   XIY First Class       [CX]        → [CX,AY]
 *
 * Positive controls (AY already listed):
 *   HKT Coral Executive   [CX,AY,MH,WY,QR]
 *   GOT Menzies Lounge    [BA,AY]      (Schengen zone)
 *
 * No new carriers (AY, BA, CX, MH, QR, WY all in DB).
 *
 * NOT included:
 *   No further scraped airports left with unseeded Ryhmä 1 lounges.
 *   Ryhmä 4 (PP-only) airports (BIQ/BOO/GZP/KKN/TOS/TRD) — out of
 *     autonomous scope per user rules.
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results  (primary)
 *   https://www.marhabaservices.com                  (MEL Marhaba)
 *   https://www.airportthai.co.th                    (HKT Coral operator)
 *   https://www.aena.es                              (AYT — nope, wrong country; use TAV)
 *   https://tav.aero                                 (AYT TAV Airports operator)
 *   https://www.swedavia.com                         (GOT operator)
 *   https://www.menziesaviation.com                  (GOT Menzies operator)
 *   https://www.prioritypass.com                     (PP network)
 *
 * Idempotent: skips by (airport_id, name); channels by (lounge_id,
 * channel_type, alliance_access).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_PP       = 'https://www.prioritypass.com';
const SOURCE_MARHABA  = 'https://www.marhabaservices.com';
const SOURCE_HKT      = 'https://www.airportthai.co.th';
const SOURCE_TAV      = 'https://tav.aero';
const SOURCE_MENZIES  = 'https://www.menziesaviation.com';
const SOURCE_XIY      = 'https://www.xxia.gov.cn';

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
const FIRST    = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room', 'Spa'];

const LOUNGES: LoungeSpec[] = [
  { iata: 'MEL', name: 'Marhaba Business Lounge',
    locationDescription: 'Terminal 2, main concourse, Level 3, between Gates 9 and 11, upstairs, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['QR', 'AY'], SOURCE_MARHABA) },  // §36
  { iata: 'MEL', name: 'Marhaba Lounge',
    locationDescription: 'Terminal 2, Satellite Extension, Level 3, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['MH', 'AY'], SOURCE_MARHABA) },  // §36

  { iata: 'HKT', name: 'The Coral Executive Lounge',
    locationDescription: 'International Departures, 4/F South Wing, opposite Gate 15, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['CX', 'AY', 'MH', 'WY', 'QR'], SOURCE_HKT) },
  { iata: 'HKT', name: 'The Coral First Class Lounge',
    locationDescription: 'International Departure, 4/F, opposite Gate 11, after security',
    tier: 'ultra_premium', loungeClass: 'first', area: 'all',
    openingHours: null, amenities: FIRST,
    channels: RYHMA_1_CHANNELS(['CX', 'AY'], SOURCE_HKT) },  // §36

  { iata: 'AYT', name: 'CIP Lounge',
    locationDescription: 'Terminal 1 International, 3rd floor, International Departure Terminal, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all',
    openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['BA', 'QR', 'AY'], SOURCE_TAV) },  // §36

  { iata: 'GOT', name: 'The Lounge by Menzies Aviation',
    locationDescription: 'Terminal 1, Schengen area, next to Gate 18, after security',
    tier: 'premium', loungeClass: 'business', area: 'schengen',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'AY'], SOURCE_MENZIES) },

  { iata: 'XIY', name: 'First Class Lounge',
    locationDescription: 'Terminal 5, International Departure Hall, near Gate 256, after security',
    tier: 'ultra_premium', loungeClass: 'first', area: 'all',
    openingHours: null, amenities: FIRST,
    channels: RYHMA_1_CHANNELS(['CX', 'AY'], SOURCE_XIY) },  // §36
];

const airportIds: Record<string, number> = {};
for (const iata of ['MEL', 'HKT', 'AYT', 'GOT', 'XIY']) {
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
