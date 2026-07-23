/**
 * Phase 32 (Batch 3e): Seed 8 Ryhmä 1 third-party Americas lounges.
 *
 * Six airports (all Phase 30 hubs for AA/Alaska Ryhmä 2 lounges — this
 * batch layers third-party alongside):
 *
 *   DFW  2  Plaza Premium lounge · The Club at DFW
 *   LAX  1  The Los Angeles Business Lounge
 *   MIA  1  Global (Turkish Airlines) Lounge
 *   ORD  1  LOT Business Lounge Chicago O'Hare
 *   SEA  1  The Club - SEA
 *   YYZ  2  Plaza Premium Lounge (T1) · Plaza Premium Lounge (T3 International)
 *
 * Same 5-channel Ryhmä 1 model as previous batches. §36 AY-lisäys
 * applied to 3 lounges.
 *
 * §36 targets (3):
 *   DFW  The Club at DFW               [QF]        → [QF,AY]
 *   SEA  The Club - SEA                [CX]        → [CX,AY]
 *   YYZ  Plaza Premium Lounge (T1)     [AT,IB]     → [AT,IB,AY]
 *
 * Positive controls (AY already listed — verifies §36 doesn't over-add):
 *   DFW  Plaza Premium lounge          [AY]
 *   LAX  The LA Business Lounge        [AA,BA,CX,FJ,AY,IB,JL,QF,QR]  ← FJ probe
 *   MIA  Global (TK) Lounge            [AY,QR]
 *   ORD  LOT Business Lounge           [CX,AY,IB,QR,RJ]
 *   YYZ  Plaza Premium T3 International [BA,CX,AY,IB,QR]
 *
 * New carrier (seeded separately): FJ (Fiji Airways) — oneworld connect
 * associate. Appears only in LAX Business Lounge carrier list.
 *
 * All USA/Canada lounges area='all' (no Schengen/non-Schengen split
 * applies from the passenger perspective; every departure is either
 * domestic-US, transborder, or international, but this doesn't map to
 * the engine's Schengen area gate).
 *
 * NOT included:
 *   JFK — user rule: "vanhat demo-kentät" list, ask before touching
 *   ATL/BOS/PDX/YVR/YUL/etc. — not in scrape output
 *   Ryhmä 2 airline-branded already covered (AA×N in Phase 30, BA in
 *     Batch 2c for MIA/SEA)
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results  (primary)
 *   https://www.plazapremiumlounge.com               (DFW, YYZ PP)
 *   https://airportlounges.com                       (SEA/DFW "The Club")
 *   https://www.turkishairlines.com                  (MIA Global TK Lounge operator)
 *   https://www.lot.com/lounges                      (ORD LOT Business Lounge)
 *   https://www.airport-la.com                       (LAX Business Lounge)
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
const SOURCE_PLAZA    = 'https://www.plazapremiumlounge.com';
const SOURCE_CLUB     = 'https://airportlounges.com';
const SOURCE_TK       = 'https://www.turkishairlines.com';
const SOURCE_LOT      = 'https://www.lot.com/lounges';
const SOURCE_LAX      = 'https://www.airport-la.com';

interface ChannelSpec { channelType: string; allianceAccess: 'all_alliance' | 'carrier_specific' | null; minAllianceTier: string | null; carrierRestriction: string[] | null; priority: number; confidence: number; sourceUrl: string; }
interface LoungeSpec { iata: string; name: string; locationDescription: string; tier: 'ultra_premium' | 'premium' | 'standard'; loungeClass: 'first' | 'business' | 'standard'; area: 'schengen' | 'non_schengen' | 'international' | 'all'; openingHours: string | null; amenities: string[]; channels: ChannelSpec[]; }

const RYHMA_1_CHANNELS = (carriers: string[], operatorSource: string): ChannelSpec[] => [
  { channelType: 'alliance_status', allianceAccess: 'carrier_specific', minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: operatorSource },
];

const PREMIUM = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const LOUNGES: LoungeSpec[] = [
  { iata: 'DFW', name: 'Plaza Premium Lounge',
    locationDescription: 'Terminal D, Level 2, by Gate 15, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AY'], SOURCE_PLAZA) },  // AY only
  { iata: 'DFW', name: 'The Club at DFW',
    locationDescription: 'Terminal D, airside, near Gates D21 & D22, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['QF', 'AY'], SOURCE_CLUB) },  // §36

  { iata: 'LAX', name: 'The Los Angeles Business Lounge',
    locationDescription: 'Tom Bradley International Terminal, Level 5, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AA', 'BA', 'CX', 'FJ', 'AY', 'IB', 'JL', 'QF', 'QR'], SOURCE_LAX) },  // FJ probe

  { iata: 'MIA', name: 'Global (Turkish Airlines) Lounge',
    locationDescription: 'Central Terminal E, after TSA Security Checkpoint 5, near Duty Free',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AY', 'QR'], SOURCE_TK) },

  { iata: 'ORD', name: 'LOT Business Lounge Chicago O\'Hare',
    locationDescription: 'Terminal 5, close to Gate M18, dining area, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['CX', 'AY', 'IB', 'QR', 'RJ'], SOURCE_LOT) },

  { iata: 'SEA', name: 'The Club - SEA',
    locationDescription: 'International Terminal, S Gate Lounge level, South Satellite, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['CX', 'AY'], SOURCE_CLUB) },  // §36

  { iata: 'YYZ', name: 'Plaza Premium Lounge',
    locationDescription: 'Terminal 1, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AT', 'IB', 'AY'], SOURCE_PLAZA) },  // §36
  { iata: 'YYZ', name: 'Plaza Premium Lounge - International Terminal 3',
    locationDescription: 'Terminal 3, International Departures, AT Level, via Gate C32',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'CX', 'AY', 'IB', 'QR'], SOURCE_PLAZA) },
];

const airportIds: Record<string, number> = {};
for (const iata of ['DFW', 'LAX', 'MIA', 'ORD', 'SEA', 'YYZ']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) { console.error(`${iata} airport not found — aborting`); process.exit(1); }
  airportIds[iata] = row.id;
}

// Verify FJ prereq
const fjRow = db.prepare(`SELECT id FROM airlines WHERE iata_code = 'FJ'`).get() as { id: number } | undefined;
if (!fjRow) { console.error(`FJ not found in airlines — run patch-seed-fj-fiji-airways-batch-3e.ts first`); process.exit(1); }

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
