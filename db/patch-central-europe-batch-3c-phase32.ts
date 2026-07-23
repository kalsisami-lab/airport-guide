/**
 * Phase 32 (Batch 3c): Seed 33 Ryhmä 1 third-party Central + Western Europe lounges.
 *
 * Largest Ryhmä 1 batch to date. 18 airports across 7 countries. Same
 * 5-channel Ryhmä 1 model as Batch 3a/3b (carrier_specific + PP + LK + DP + paid),
 * §36 AY-lisäys where the oneworld.com snapshot lacks Finnair.
 *
 * Distribution:
 *   Germany       (6 airports)  MUC 2 · DUS 2 · HAM 1 · HAJ 1 · STR 1 · BER 1
 *   France        (4 airports)  CDG 2 · NCE 3 · LYS 3 · BOD 1
 *   Switzerland   (2 airports)  ZRH 4 · GVA 3
 *   Austria       (3 airports)  VIE 2 · INN 1 · SZG 1
 *   Netherlands   (1)           AMS 2
 *   Belgium       (1)           BRU 2
 *   Luxembourg    (1)           LUX 1
 *
 * §36 rule applied to 22 lounges. Positive controls (AY already listed):
 *   AMS Aspire No.26  |  BER Tempelhof  |  DUS Rhein  |  MUC Europa  |
 *   NCE Infinity  |  CDG Extime  |  ZRH Airport Center  |  GVA Horizon  |
 *   LUX by Luxair  |  VIE Vienna  |  HAM Airport Lounge
 *
 * NOT included (deferred):
 *   FRA (Frankfurt) — 2 relevant scraped lounges (Primeclass conflict with
 *     existing Primeclass Business Lounge, Priority Lounge new). FRA has
 *     mixed pre-existing demo/Ryhmä 2 data (Lufthansa FCL, Senator, JAL,
 *     Qatar, Aspire, Primeclass Business). Owner review required before
 *     touching — see follow-up batch.
 *   VIE Air Lounge — scrape name literally "TEMPORARILY CLOSED" (§39-style
 *     deferral). Add back when reopened.
 *   Ryhmä 2 airline-branded lounges at these airports (BRU + others may
 *     have QR/Al Safwa; MUC Lufthansa Senator is a real Star lounge already
 *     out of scope for oneworld batches).
 *
 * All 11 carriers in scope (AA, AT, AY, BA, CX, IB, JL, MH, QR, RJ, WY)
 * already in `airlines` from Phase 30 / Batch 3a. No new carrier seed.
 *
 * Sources: oneworld.com/airport-lounge-results + individual operators
 * (Plaza Premium, Aspire, Marhaba, Primeclass, Menzies, Airport Authority
 * local operators). PP-network via prioritypass.com.
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
const SOURCE_ASPIRE   = 'https://www.executivelounges.com';
const SOURCE_PLAZA    = 'https://www.plazapremiumlounge.com';
const SOURCE_MARHABA  = 'https://www.marhabaservices.com';
const SOURCE_MENZIES  = 'https://www.menziesaviation.com';
const SOURCE_SWISSPORT = 'https://www.swissport.com';

interface ChannelSpec {
  channelType: string;
  allianceAccess: 'all_alliance' | 'carrier_specific' | null;
  minAllianceTier: string | null;
  carrierRestriction: string[] | null;
  priority: number;
  confidence: number;
  sourceUrl: string;
}

interface LoungeSpec {
  iata: string;
  name: string;
  locationDescription: string;
  tier: 'ultra_premium' | 'premium' | 'standard';
  loungeClass: 'first' | 'business' | 'standard';
  area: 'schengen' | 'non_schengen' | 'international' | 'all';
  openingHours: string | null;
  amenities: string[];
  channels: ChannelSpec[];
}

const RYHMA_1_CHANNELS = (carriers: string[], operatorSource: string): ChannelSpec[] => [
  { channelType: 'alliance_status', allianceAccess: 'carrier_specific',
    minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers,
    priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: operatorSource },
];

const STANDARD = ['Buffet', 'Bar', 'WiFi', 'Workspace'];
const PREMIUM  = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const LOUNGES: LoungeSpec[] = [
  // ── Germany (8) ──────────────────────────────────────────────────────────
  { iata: 'MUC', name: 'Airport Lounge World', locationDescription: 'Terminal 1, non-Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AA', 'BA', 'CX', 'WY', 'QR', 'RJ', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'MUC', name: 'Europa Lounge', locationDescription: 'Terminal 2, Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AY'], SOURCE_ASPIRE) },
  { iata: 'DUS', name: 'DUS Rhein Lounge', locationDescription: 'Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'schengen', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AY', 'IB'], SOURCE_ASPIRE) },
  { iata: 'DUS', name: 'DUS Sky Lounge', locationDescription: 'Non-Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'non_schengen', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'QR', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'HAM', name: 'Hamburg Airport Lounge', locationDescription: 'Departure level, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'AY', 'IB', 'QR'], SOURCE_ASPIRE) },
  { iata: 'HAJ', name: 'Melli-Beese Lounge', locationDescription: 'Terminal C, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['BA', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'STR', name: 'Airport Lounge', locationDescription: 'Terminal 3, Level 4, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['BA', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'BER', name: 'Lounge Tempelhof', locationDescription: 'Terminal 1, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'AY', 'IB', 'QR'], SOURCE_ASPIRE) },

  // ── France (9) ───────────────────────────────────────────────────────────
  { iata: 'CDG', name: 'Extime Lounge', locationDescription: 'Terminal 2, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AT', 'AY', 'WY'], SOURCE_ASPIRE) },
  { iata: 'CDG', name: 'PrimeClass Lounge', locationDescription: 'Terminal 1, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'MH', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'NCE', name: 'Infinity Lounge', locationDescription: 'Terminal 2, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AY'], SOURCE_ASPIRE) },
  { iata: 'NCE', name: 'The Canopy VIP Lounge', locationDescription: 'Terminal 2, non-Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'non_schengen', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AA', 'BA', 'QR', 'AT', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'NCE', name: 'The Library VIP Lounge', locationDescription: 'Terminal 1, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['IB', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'LYS', name: 'Confluence Lounge', locationDescription: 'Terminal 1, Schengen area, after security',
    tier: 'standard', loungeClass: 'standard', area: 'schengen', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['IB', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'LYS', name: 'Mont Blanc Lounge', locationDescription: 'Terminal 1, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['BA', 'IB', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'LYS', name: 'Salon Mont-Blanc', locationDescription: 'Terminal 2, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['AT', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'BOD', name: 'Salon des Vignobles', locationDescription: 'Departure level, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['BA', 'IB', 'AT', 'AY'], SOURCE_ASPIRE) },  // §36

  // ── Switzerland (7) ──────────────────────────────────────────────────────
  { iata: 'ZRH', name: 'Aspire Lounge (Airport Center)', locationDescription: 'Airport Center, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'CX', 'AY', 'IB', 'RJ'], SOURCE_ASPIRE) },
  { iata: 'ZRH', name: 'Aspire Lounge (Dock E)', locationDescription: 'Dock E, non-Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'non_schengen', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'ZRH', name: 'Marhaba Lounge', locationDescription: 'Terminal 2, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AT', 'AY'], SOURCE_MARHABA) },  // §36
  { iata: 'ZRH', name: 'Primeclass Lounge', locationDescription: 'Terminal 2, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AA', 'WY', 'QR', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'GVA', name: 'Aspire Crystal Lounge', locationDescription: 'Departure level, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AT', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'GVA', name: 'Horizon Lounge', locationDescription: 'Terminal 1, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AY', 'AT', 'RJ'], SOURCE_ASPIRE) },
  { iata: 'GVA', name: 'Marhaba Lounge 2 (East Wing)', locationDescription: 'Terminal 1, East Wing, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['IB', 'QR', 'AY'], SOURCE_MARHABA) },  // §36

  // ── Austria (4) — VIE Air Lounge deferred (TEMPORARILY CLOSED) ──────────
  { iata: 'VIE', name: 'Sky Lounge', locationDescription: 'Non-Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'non_schengen', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['QR', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'VIE', name: 'Vienna Lounge', locationDescription: 'Terminal 3, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'AY', 'IB', 'QR'], SOURCE_ASPIRE) },
  { iata: 'INN', name: 'Tyrol Lounge', locationDescription: 'Departure level, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['BA', 'IB', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'SZG', name: 'Business Lounge', locationDescription: 'Departure level, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all', openingHours: null, amenities: STANDARD,
    channels: RYHMA_1_CHANNELS(['BA', 'IB', 'AY'], SOURCE_ASPIRE) },  // §36

  // ── Netherlands, Belgium, Luxembourg (5) ────────────────────────────────
  { iata: 'AMS', name: 'oneworld Lounge (Lounge No.40)', locationDescription: 'Non-Schengen area, near Lounge No.40, after security',
    tier: 'premium', loungeClass: 'business', area: 'non_schengen', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AA', 'BA', 'CX', 'WY', 'QR', 'AT', 'RJ', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'AMS', name: 'Aspire Lounge (No.26)', locationDescription: 'Schengen area, near Lounge No.26, after security',
    tier: 'premium', loungeClass: 'business', area: 'schengen', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['AY', 'IB'], SOURCE_ASPIRE) },
  { iata: 'BRU', name: 'Diamond Lounge Pier A', locationDescription: 'Pier A, Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['IB', 'AT', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'BRU', name: 'The View', locationDescription: 'Non-Schengen area, after security',
    tier: 'premium', loungeClass: 'business', area: 'non_schengen', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'CX', 'QR', 'AY'], SOURCE_ASPIRE) },  // §36
  { iata: 'LUX', name: 'The Lounge by Luxair', locationDescription: 'Terminal A, after security',
    tier: 'premium', loungeClass: 'business', area: 'all', openingHours: null, amenities: PREMIUM,
    channels: RYHMA_1_CHANNELS(['BA', 'AY'], SOURCE_ASPIRE) },
];

const IATAS = ['MUC','DUS','HAM','HAJ','STR','BER','CDG','NCE','LYS','BOD','ZRH','GVA','VIE','INN','SZG','AMS','BRU','LUX'];
const airportIds: Record<string, number> = {};
for (const iata of IATAS) {
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
      console.log(`  ✓ ${spec.iata} ${spec.name} (id=${loungeId}, area=${spec.area})`);
      lI++;
    }
    for (const ch of spec.channels) {
      const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = ? AND (alliance_access IS ? OR alliance_access = ?)`)
        .get(loungeId, ch.channelType, ch.allianceAccess, ch.allianceAccess) as { id: number } | undefined;
      if (existingCh) { console.log(`    ↩ ${ch.channelType}/${ch.allianceAccess ?? '—'} — skip`); cS++; continue; }
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
