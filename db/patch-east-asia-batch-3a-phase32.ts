/**
 * Phase 32 (Batch 3a): Seed 19 Ryhmä 1 third-party oneworld lounges — East Asia.
 *
 * First Ryhmä 1 batch since Phase 29 (Baltics/CE). Mirrors the Greece Phase 27
 * shape (carrier_specific + PP + LK + DP + paid) for the third-party operator
 * lounges, plus one Ryhmä 2 override at ICN (see below).
 *
 * Coverage: 7 airports, 19 lounges. All non-Schengen airports → `area = 'all'`
 * uniformly (no zone split).
 *
 *   BKK (Bangkok Suvarnabhumi)  — 2  Miracle Business Class + Miracle First Class
 *   HKG (Hong Kong)             — 5  Plaza Premium First / PP First East Hall (Infinity Room) /
 *                                    PP Lounge / PP East Hall / PP West Hall
 *   ICN (Incheon)               — 1  oneworld Lounge (Ryhmä 2 all_alliance — see below)
 *   KIX (Kansai)                — 3  KIX Kansai / KIX Premium / Lounge KANSAI (domestic)
 *   NGO (Chubu Centrair)        — 2  Centrair Airline Lounge (Domestic) / Plaza Premium Lounge
 *   PVG (Shanghai Pudong)       — 2  No.71 Air China F/C+B/C / NO.77 VIP LOUNGE
 *   SIN (Singapore Changi)      — 4  Dnata / Marhaba / Plaza Premium First / SATS Premier
 *
 * §36 AY-lisäys (10 lounges, conf 0.95):
 *   BKK Miracle First     [QR]                → [QR,AY]
 *   HKG PP First East Hall (Infinity Room) [QR]         → [QR,AY]
 *   HKG Plaza Premium Lounge [MH,QR]          → [MH,QR,AY]
 *   HKG PP West Hall      [MH,QR]             → [MH,QR,AY]
 *   KIX Premium           [CX,JL,QR]          → [CX,JL,QR,AY]
 *   KIX Lounge KANSAI     [JL]                → [JL,AY]  (Hawaiian Airlines unmapped → dropped)
 *   NGO Centrair Airline  [JL]                → [JL,AY]
 *   PVG NO.77 VIP LOUNGE  [QR]                → [QR,AY]
 *   SIN Dnata Lounge      [UL]                → [UL,AY]
 *   SIN SATS Premier      [MH,QR]             → [MH,QR,AY]
 *
 * All 10 §36 kentät ovat Finnair-verkossa (HEL→BKK, HEL→HKG, HEL→ICN,
 * HEL→NRT via KIX/NGO-lähialue, HEL→PVG, HEL→SIN). Sääntö pätee suoraan.
 *
 * ICN oneworld Lounge — poikkeus Ryhmä 2 -mallilla:
 *   Scrape mainitsee `unmappedCarrierNames: ["oneworld"]` eli sivu sanoo että
 *   kaikki oneworld-jäsenet pääsevät (ei rajattua carrier-listaa vaikka scrape
 *   näyttääkin listaa muodollisen kentän vuoksi). Käytetään Phase 31 -mallia
 *   yhdellä alliance_status/all_alliance -kanavalla, ei PP/paid.
 *
 * KIX Lounge KANSAI:
 *   Domestic terminal, "Before Security". Standard-tier gate lounge. Scrape:
 *   `unmapped: Hawaiian Airlines` — HA ei ole oneworld, jätetään pois carrier-
 *   listasta. Menee muuten normaali Ryhmä 1 -malliin (carrier_specific + PP/LK/DP/paid).
 *
 * Uudet carrierit (RJ, UL) seedattu erillisellä patchilla:
 *   db/patch-seed-oneworld-carriers-batch-3a.ts
 *   (RJ = Royal Jordanian, UL = SriLankan — molemmat oneworld sapphire member)
 *
 * NOT included:
 *   - Ryhmä 2 airline-branded lounget näissä kentissä (jo Phase 31: BKK CX/JL,
 *     HKG CX×5 QF/JAL/CX, HND CX/JL×4, NRT JL×3, NGO JL, PVG CX, SIN CX/JL/QF).
 *   - Ryhmä 3 AMBIG contract lounget (PVG SAA + China Eastern) — omat päätökset.
 *   - amex_centurion (näissä kentissä PP-verkko kattaa Amex Platinumin).
 *   - opening_hours (skraaperi ei anna, jätetään NULL).
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results  (per-airport, primary)
 *   https://www.plazapremiumlounge.com               (operator — HKG, NGO, SIN PP First)
 *   https://www.miraclelounge.com                    (operator — BKK Miracle)
 *   https://www.marhabaservices.com                  (operator — SIN Marhaba)
 *   https://www.dnata.com                            (operator — SIN Dnata)
 *   https://www.sats.com.sg                          (operator — SIN SATS Premier)
 *   https://www.kansai-airports.co.jp                (operator — KIX)
 *   https://www.centrair.jp                          (operator — NGO Centrair)
 *   https://www.airchina.us/US/EN/lounges/           (operator — PVG No.71)
 *   https://www.prioritypass.com                     (PP network membership)
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
const SOURCE_PLAZA    = 'https://www.plazapremiumlounge.com';
const SOURCE_MIRACLE  = 'https://www.miraclelounge.com';
const SOURCE_MARHABA  = 'https://www.marhabaservices.com';
const SOURCE_DNATA    = 'https://www.dnata.com';
const SOURCE_SATS     = 'https://www.sats.com.sg';
const SOURCE_KIX      = 'https://www.kansai-airports.co.jp';
const SOURCE_NGO      = 'https://www.centrair.jp';
const SOURCE_AIRCHINA = 'https://www.airchina.us/US/EN/lounges/';

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

// Ryhmä 1 full channel set: carrier_specific + PP + LK + DP + paid.
// AY is appended to `carriers` per §36 when missing from oneworld.com's snapshot.
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

// Ryhmä 2 override for ICN oneworld Lounge — all_alliance, single channel, no PP/paid.
const RYHMA_2_ONEWORLD_CHANNELS: ChannelSpec[] = [
  {
    channelType: 'alliance_status', allianceAccess: 'all_alliance',
    minAllianceTier: 'oneworld_sapphire', carrierRestriction: null,
    priority: 100, confidence: 0.99, sourceUrl: SOURCE_ONEWORLD,
  },
];

const STANDARD_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Workspace'];
const PREMIUM_AMENITIES  = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];
const FIRST_AMENITIES    = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room', 'Spa'];

const LOUNGES: LoungeSpec[] = [
  // ── BKK Suvarnabhumi (2) ─────────────────────────────────────────────────
  {
    iata: 'BKK', name: 'Miracle Business Class Lounge',
    locationDescription: 'International Departure Terminal Level 3, Concourse D, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['BA', 'AY', 'MH', 'QF', 'QR', 'UL'], SOURCE_MIRACLE),
  },
  {
    iata: 'BKK', name: 'Miracle First Class Lounge',
    locationDescription: 'Main Terminal, Concourse D, after security',
    tier: 'ultra_premium', loungeClass: 'first', area: 'all',
    openingHours: null, amenities: FIRST_AMENITIES,
    // §36: QR only in snapshot → add AY (Finnair HEL→BKK)
    channels: RYHMA_1_CHANNELS(['QR', 'AY'], SOURCE_MIRACLE),
  },

  // ── HKG Hong Kong International (5) ──────────────────────────────────────
  {
    iata: 'HKG', name: 'Plaza Premium First',
    locationDescription: 'Terminal 1, near Gate 1, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AY'], SOURCE_PLAZA),
  },
  {
    iata: 'HKG', name: 'Plaza Premium First (East Hall) (Infinity Room)',
    locationDescription: 'Terminal 1, near Gate 1, Departures Level (L6), after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    // §36: QR only in snapshot → add AY
    channels: RYHMA_1_CHANNELS(['QR', 'AY'], SOURCE_PLAZA),
  },
  {
    iata: 'HKG', name: 'Plaza Premium Lounge',
    locationDescription: 'Terminal 1, near Gate 35, Departure Level (L6), after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    // §36: [MH,QR] in snapshot → add AY
    channels: RYHMA_1_CHANNELS(['MH', 'QR', 'AY'], SOURCE_PLAZA),
  },
  {
    iata: 'HKG', name: 'Plaza Premium Lounge (East Hall)',
    locationDescription: 'Terminal 1, near Gate 1, Departure Level (L6), after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    // Already lists AY — positive control for §36 idempotency
    channels: RYHMA_1_CHANNELS(['AY', 'QR', 'RJ', 'UL'], SOURCE_PLAZA),
  },
  {
    iata: 'HKG', name: 'Plaza Premium Lounge (West Hall)',
    locationDescription: 'Terminal 1, near Gate 60, Departure Level (L7), after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    // §36: [MH,QR] in snapshot → add AY
    channels: RYHMA_1_CHANNELS(['MH', 'QR', 'AY'], SOURCE_PLAZA),
  },

  // ── ICN Incheon (1) — Ryhmä 2 all_alliance ───────────────────────────────
  {
    iata: 'ICN', name: 'oneworld Lounge',
    locationDescription: 'Terminal 1, Gate 28 (4th floor), after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    // Scrape unmappedCarrierNames = ["oneworld"] → all oneworld members eligible
    channels: RYHMA_2_ONEWORLD_CHANNELS,
  },

  // ── KIX Kansai (3) ───────────────────────────────────────────────────────
  {
    iata: 'KIX', name: 'KIX Lounge Kansai',
    locationDescription: 'Terminal 1 International, central area near Gate 21, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AY', 'CX', 'QR'], SOURCE_KIX),
  },
  {
    iata: 'KIX', name: 'KIX Lounge Premium',
    locationDescription: 'Terminal 1 International, near Gate 21, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    // §36: [CX,JL,QR] → add AY
    channels: RYHMA_1_CHANNELS(['CX', 'JL', 'QR', 'AY'], SOURCE_KIX),
  },
  {
    iata: 'KIX', name: 'Lounge KANSAI',
    locationDescription: 'Domestic Terminal, Level 3, before security',
    tier: 'standard', loungeClass: 'standard', area: 'all',
    openingHours: null, amenities: STANDARD_AMENITIES,
    // §36: [JL] → add AY. Scrape unmapped "Hawaiian Airlines" — HA not oneworld, dropped.
    channels: RYHMA_1_CHANNELS(['JL', 'AY'], SOURCE_KIX),
  },

  // ── NGO Chubu Centrair (2) ───────────────────────────────────────────────
  {
    iata: 'NGO', name: 'Centrair Airline Lounge (Domestic)',
    locationDescription: 'Level 3, after security',
    tier: 'standard', loungeClass: 'standard', area: 'all',
    openingHours: null, amenities: STANDARD_AMENITIES,
    // §36: [JL] → add AY
    channels: RYHMA_1_CHANNELS(['JL', 'AY'], SOURCE_NGO),
  },
  {
    iata: 'NGO', name: 'Plaza Premium Lounge',
    locationDescription: 'Terminal 1, 2nd floor, next to Gate 18 (elevator from 3rd floor), after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['CX', 'AY'], SOURCE_PLAZA),
  },

  // ── PVG Shanghai Pudong (2) ──────────────────────────────────────────────
  {
    iata: 'PVG', name: 'No. 71 - Air China First Class and Business Class Lounges',
    locationDescription: 'Terminal 2, 3rd floor, Gate 71, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AA', 'AY', 'IB'], SOURCE_AIRCHINA),
  },
  {
    iata: 'PVG', name: 'NO.77 VIP LOUNGE',
    locationDescription: 'Terminal 2, Departure area, lift between boarding gates D75 & D77, before security',
    tier: 'standard', loungeClass: 'standard', area: 'all',
    openingHours: null, amenities: STANDARD_AMENITIES,
    // §36: [QR] → add AY
    channels: RYHMA_1_CHANNELS(['QR', 'AY'], SOURCE_AIRCHINA),
  },

  // ── SIN Singapore Changi (4) ─────────────────────────────────────────────
  {
    iata: 'SIN', name: 'Dnata Lounge',
    locationDescription: 'Terminal 3, 3rd floor, central area, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    // §36: [UL] → add AY. Tests exercise UL new-carrier path here.
    channels: RYHMA_1_CHANNELS(['UL', 'AY'], SOURCE_DNATA),
  },
  {
    iata: 'SIN', name: 'Marhaba Lounge',
    locationDescription: 'Terminal 1, Level 3, near Gate D30, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AY', 'JL'], SOURCE_MARHABA),
  },
  {
    iata: 'SIN', name: 'Plaza Premium First',
    locationDescription: 'Terminal 1, Level 3, Departure/Transit Lounge West, before security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    channels: RYHMA_1_CHANNELS(['AY'], SOURCE_PLAZA),
  },
  {
    iata: 'SIN', name: 'SATS Premier Lounge',
    locationDescription: 'Terminal 2, Level 3, Departure Hall, after security',
    tier: 'premium', loungeClass: 'business', area: 'all',
    openingHours: null, amenities: PREMIUM_AMENITIES,
    // §36: [MH,QR] → add AY
    channels: RYHMA_1_CHANNELS(['MH', 'QR', 'AY'], SOURCE_SATS),
  },
];

// Resolve airport ids up-front (fail fast if any missing)
const airportIds: Record<string, number> = {};
for (const iata of ['BKK', 'HKG', 'ICN', 'KIX', 'NGO', 'PVG', 'SIN']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) {
    console.error(`${iata} airport not found — aborting`);
    process.exit(1);
  }
  airportIds[iata] = row.id;
}

// Verify new carriers RJ + UL are present (Batch-3a carrier seed run first)
for (const code of ['RJ', 'UL']) {
  const row = db.prepare(`SELECT id FROM airlines WHERE iata_code = ?`).get(code) as { id: number } | undefined;
  if (!row) {
    console.error(`${code} not found in airlines — run patch-seed-oneworld-carriers-batch-3a.ts first`);
    process.exit(1);
  }
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
      console.log(`  ✓ Inserted ${spec.iata} ${spec.name} (id=${loungeId}, tier=${spec.tier})`);
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
  console.log(`Ryhmä 1 model: 18 lounges (5-channel carrier_specific + PP/LK/DP/paid, §36 AY-lisäys 10 tapausta).`);
  console.log(`Ryhmä 2 model: 1 lounge (ICN oneworld Lounge, all_alliance).`);
})();

db.close();
