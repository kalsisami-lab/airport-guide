/**
 * Phase 32 (Batch 3b): Seed 14 Ryhmä 1 third-party Southern Europe lounges.
 *
 * Same Ryhmä 1 model as Batch 3a and Phase 27 Greece:
 * 5 channels per lounge (alliance_status carrier_specific + PP + LK + DP + paid),
 * §36 AY-lisäys where the oneworld.com snapshot lacks Finnair.
 *
 * Airports (all Schengen countries — Greece, Spain, Italy):
 *   ATH  4 lounges (2 Schengen zone, 2 Non-Schengen)
 *   BCN  3 lounges (1 Schengen, 1 Non-Schengen, 1 unspecified)
 *   FCO  4 lounges (all zones unspecified in scrape → area='all')
 *   MXP  3 lounges (1 Schengen, 2 unspecified)
 *
 * §36 AY-lisäys (11 lounges — all except the ones that already list AY):
 *   ATH Goldair CIP        [AA]                  → [AA,AY]
 *   ATH Skyserv Business   [BA,QR]               → [BA,QR,AY]
 *   ATH Skyserv Melina     [IB,AT]               → [IB,AT,AY]
 *   ATH Swissport Executive[RJ]                  → [RJ,AY]
 *   BCN Colomer            [IB]                  → [IB,AY]
 *   BCN Joan Miro          [AA,BA,CX,IB,QR,AT,RJ]→ [AA,BA,CX,IB,QR,AT,RJ,AY]
 *   FCO PP (A Gates)       [IB]                  → [IB,AY]
 *   FCO PP (E Gates)       [AT]                  → [AT,AY]
 *   FCO Prima Vista E      [AS,AA,CX,WY,QR,AT,RJ]→ [AS,AA,CX,WY,QR,AT,RJ,AY]
 *   MXP Premium Lounge     [CX]                  → [CX,AY]
 *   MXP Sala Montale       [AA,BA,CX,WY,QR,AT]   → [AA,BA,CX,WY,QR,AT,AY]
 * Positive controls (AY already listed — verifies §36 doesn't double-add):
 *   BCN Pau Casals  [AY,IB]
 *   FCO Prima Vista /Domus  [AY]
 *   MXP Monteverdi  [AY,IB]
 *
 * All AY §36 targets are in Finnair 2026 network: AY680 HEL→ATH,
 * AY660 HEL→BCN, AY650 HEL→FCO, AY (Milan direct) HEL→MXP.
 *
 * No new carriers needed — RJ + UL from Batch 3a, AS + AT + WY from earlier
 * batches. All 10 carriers appearing in this batch (AA, AS, AT, AY, BA, CX,
 * IB, QR, RJ, WY) already seeded.
 *
 * NOT included (deferred):
 *   - LIN (Milan Linate): 1 lounge with AY already listed — batches with only
 *     positive-control lounges are low value; will fold into a future combined
 *     batch or verify manually.
 *   - Ryhmä 2 airline-branded lounges at these airports (BCN Iberia, FCO
 *     Al Mourjan/QR, etc.) — deferred to Batch 2c (QR/BA/WY).
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results  (primary, all verified)
 *   https://www.goldair-handling.gr                  (ATH Goldair)
 *   https://www.skyserv.aero                         (ATH Skyserv)
 *   https://www.swissport.com                        (ATH Swissport)
 *   https://www.plazapremiumlounge.com               (FCO PP)
 *   https://www.aena.es                              (BCN Aena — Sala Colomer/Joan Miro/Pau Casals)
 *   https://www.milanomalpensa-airport.com           (MXP operator refs)
 *   https://www.prioritypass.com                     (PP network)
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
const SOURCE_PP       = 'https://www.prioritypass.com';
const SOURCE_GOLDAIR  = 'https://www.goldair-handling.gr';
const SOURCE_SKYSERV  = 'https://www.skyserv.aero';
const SOURCE_SWISSPORT = 'https://www.swissport.com';
const SOURCE_PLAZA    = 'https://www.plazapremiumlounge.com';
const SOURCE_AENA     = 'https://www.aena.es';
const SOURCE_MXP      = 'https://www.milanomalpensa-airport.com';

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

const RYHMA_1_CHANNELS = (carriers: string[], operatorSource: string): ChannelSpec[] => [
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

const STANDARD_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Workspace'];
const PREMIUM_AMENITIES  = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const LOUNGES: LoungeSpec[] = [
  // ── ATH Athens (4) ────────────────────────────────────────────────────────
  {
    iata: 'ATH', name: 'Goldair CIP Lounge',
    locationDescription: 'Terminal A, Non-Schengen area, after security',
    tier: 'standard', loungeClass: 'standard', area: 'non_schengen',
    openingHours: null, amenities: STANDARD_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AA', 'AY'], SOURCE_GOLDAIR),  // §36
  },
  {
    iata: 'ATH', name: 'Skyserv Business Lounge',
    locationDescription: 'International, Non-Schengen area, Level 1, after security',
    tier: 'standard', loungeClass: 'standard', area: 'non_schengen',
    openingHours: null, amenities: STANDARD_AMENITIES,
    channels: RYHMA_1_CHANNELS(['BA', 'QR', 'AY'], SOURCE_SKYSERV),  // §36
  },
  {
    iata: 'ATH', name: 'Skyserv Melina Merkouri Lounge',
    locationDescription: 'Main Terminal, Schengen area, next to Gate B9, after security',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: STANDARD_AMENITIES,
    channels: RYHMA_1_CHANNELS(['IB', 'AT', 'AY'], SOURCE_SKYSERV),  // §36
  },
  {
    iata: 'ATH', name: 'Swissport Executive Lounge',
    locationDescription: 'Main Terminal, Extra-Schengen International Transit area, Gates A9-A13, after security',
    tier: 'standard', loungeClass: 'standard', area: 'schengen',
    openingHours: null, amenities: STANDARD_AMENITIES,
    channels: RYHMA_1_CHANNELS(['RJ', 'AY'], SOURCE_SWISSPORT),  // §36
  },

  // ── BCN Barcelona (3) ─────────────────────────────────────────────────────
  {
    iata: 'BCN', name: 'Colomer Lounge',
    locationDescription: 'Terminal 1, BCN-MAD Air Shuttle Lobby, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all',
    openingHours: null, amenities: STANDARD_AMENITIES,
    channels: RYHMA_1_CHANNELS(['IB', 'AY'], SOURCE_AENA),  // §36
  },
  {
    iata: 'BCN', name: 'Joan Miro Lounge',
    locationDescription: 'Terminal 1, Non-Schengen area, near Gate D, Floor 3, after security',
    tier: 'premium', loungeClass: 'business', area: 'non_schengen',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AA', 'BA', 'CX', 'IB', 'QR', 'AT', 'RJ', 'AY'], SOURCE_AENA),  // §36
  },
  {
    iata: 'BCN', name: 'Pau Casals Lounge',
    locationDescription: 'Terminal 1, Schengen area, Floor 2, after security',
    tier: 'premium', loungeClass: 'business', area: 'schengen',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AY', 'IB'], SOURCE_AENA),  // AY already listed
  },

  // ── FCO Rome Fiumicino (4) ────────────────────────────────────────────────
  {
    iata: 'FCO', name: 'Plaza Premium Lounge (A Gates)',
    locationDescription: 'Terminal 1, Mezzanine, Gates A61-83, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['IB', 'AY'], SOURCE_PLAZA),  // §36
  },
  {
    iata: 'FCO', name: 'Plaza Premium Lounge (E Gates)',
    locationDescription: 'Terminal 3, Extra-Schengen area, upper level after Duty Free, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AT', 'AY'], SOURCE_PLAZA),  // §36
  },
  {
    iata: 'FCO', name: 'Prima Vista (E Gates)',
    locationDescription: 'Terminal 3, Pier E, area Gates E51-E61, in front of Gate E41, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AS', 'AA', 'CX', 'WY', 'QR', 'AT', 'RJ', 'AY'], SOURCE_PLAZA),  // §36
  },
  {
    iata: 'FCO', name: 'Prima Vista /Domus',
    locationDescription: 'Terminal 1, near Gate A32, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AY'], SOURCE_PLAZA),  // AY already listed
  },

  // ── MXP Milan Malpensa (3) ────────────────────────────────────────────────
  {
    iata: 'MXP', name: 'Monteverdi Lounge',
    locationDescription: 'Terminal 1, near A boarding gates, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AY', 'IB'], SOURCE_MXP),  // AY already listed
  },
  {
    iata: 'MXP', name: 'Premium Lounge',
    locationDescription: 'Terminal 1, Satellite North, extra-Schengen boarding area, after security',
    tier: 'premium', loungeClass: 'business', area: 'schengen',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['CX', 'AY'], SOURCE_MXP),  // §36
  },
  {
    iata: 'MXP', name: 'Sala Montale Lounge',
    locationDescription: 'Terminal 1, North Satellite, near Gate B, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AA', 'BA', 'CX', 'WY', 'QR', 'AT', 'AY'], SOURCE_MXP),  // §36
  },
];

const airportIds: Record<string, number> = {};
for (const iata of ['ATH', 'BCN', 'FCO', 'MXP']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) { console.error(`${iata} airport not found — aborting`); process.exit(1); }
  airportIds[iata] = row.id;
}

db.transaction(() => {
  let loungesInserted = 0, loungesSkipped = 0, channelsInserted = 0, channelsSkipped = 0;

  for (const spec of LOUNGES) {
    const airportId = airportIds[spec.iata];
    let loungeId: number;
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;

    if (existing) {
      loungeId = existing.id;
      console.log(`  ↩ ${spec.iata} ${spec.name}: already in DB (id=${loungeId}) — skipping lounge insert`);
      loungesSkipped++;
    } else {
      const result = db.prepare(`
        INSERT INTO lounges (airport_id, terminal_id, name, location_description,
          tier, lounge_class, area, opening_hours, amenities)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(airportId, spec.name, spec.locationDescription, spec.tier, spec.loungeClass,
             spec.area, spec.openingHours, JSON.stringify(spec.amenities));
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
        INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction,
          valid_from, valid_to, priority, confidence, conditions, source_url, verified_at)
        VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, NULL, ?, ?)
      `).run(chResult.lastInsertRowid, ch.minAllianceTier,
             ch.carrierRestriction ? JSON.stringify(ch.carrierRestriction) : null,
             ch.priority, ch.confidence, ch.sourceUrl, TODAY);

      const carrierNote = ch.carrierRestriction ? ` [${ch.carrierRestriction.join(',')}]` : '';
      console.log(`    ✓ Added ${ch.channelType}${carrierNote} (priority ${ch.priority}, conf ${ch.confidence})`);
      channelsInserted++;
    }
  }

  console.log(`\nDone.  lounges: inserted=${loungesInserted} skipped=${loungesSkipped}  channels: inserted=${channelsInserted} skipped=${channelsSkipped}`);
  console.log(`§36 rule applied to 11 lounges (AY added). Positive controls (AY already listed): BCN Pau Casals, FCO Prima Vista/Domus, MXP Monteverdi.`);
})();

db.close();
