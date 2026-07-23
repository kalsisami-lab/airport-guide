/**
 * Phase 35 (DXB part): review — enrich EK First/Business/Marhaba, seed 3 new.
 *
 * Manual data from oneworld.com/airport-lounge-results?location=DXB +
 * §51 wording classification.
 *
 * ── Update existing entries (add oneworld channels alongside existing) ─
 *
 *   Emirates First Class Lounge (id=14) → rename to "Emirates First Lounge"
 *     Existing: airline_own [EK] cabin=first-based for EK's own pax
 *     Adding: alliance_status/carrier_specific [QF, AY] emerald (§36 +AY)
 *             + PP/LK/DP/paid channels (Ryhmä 1 full model)
 *     Two parallel access paths: EK's own via airline_own, oneworld via
 *     Ryhmä 1. Engine picks highest-priority match — non-EK oneworld pax
 *     use the alliance_status path; EK pax use airline_own path.
 *
 *   Emirates Business Class Lounge (id=15) → rename to "Emirates Business Lounge"
 *     Same as First but Ryhmä 1 sapphire (not emerald). [QF, AY] §36.
 *
 *   Marhaba Lounge (id=24)
 *     Existing: PP/LK/DP channels (no oneworld/tier gate)
 *     Adding: alliance_status/carrier_specific [AY, AT] sapphire
 *     §60-TODO: QR condition in source text NOT modeled (conservative).
 *
 * ── Seed new lounges ────────────────────────────────────────────────────
 *
 *   British Airways Lounge (T1)
 *     [BA] sapphire, NO §36 (BA outstation, no wider access wording).
 *     §61-TODO: overnight hours (06:30-13:30 + 21:30-02:30) — modeled
 *     as single "06:30 - 13:30" range only until engine verification.
 *     Standard 5-channel Ryhmä 1.
 *
 *   Ahlan Business Class Lounge (T1)
 *     [CX, RJ, UL, AY] sapphire §36. 24h. Standard 5-channel.
 *
 *   Ahlan First Class Lounge (T1)
 *     [CX, QR, AY] emerald §36 (§52 OR-model: data lists "First Class"
 *     + "Emerald Tier" separately). Standard 5-channel with emerald floor.
 *
 * area='all' throughout (DXB outside Schengen, no zone split).
 *
 * Sources:
 *   oneworld.com/airport-lounge-results?location=DXB (manual)
 *   emirates.com/lounges  britishairways.com/lounges
 *   marhabaservices.com   ahlanservices.com
 *
 * Idempotent per (airport_id, name) for new inserts; channel adds
 * guarded by (lounge_id, channel_type, alliance_access).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results?location=DXB';
const SOURCE_EK       = 'https://www.emirates.com/lounges';
const SOURCE_BA       = 'https://www.britishairways.com/en-gb/information/at-the-airport/lounges';
const SOURCE_MARHABA  = 'https://www.marhabaservices.com';
const SOURCE_AHLAN    = 'https://www.ahlanservices.com';
const SOURCE_PP       = 'https://www.prioritypass.com';

function loungeId(iata: string, name: string): number | null {
  const row = db.prepare(`SELECT l.id FROM lounges l JOIN airports a ON a.id = l.airport_id WHERE a.iata_code = ? AND l.name = ?`).get(iata, name) as { id: number } | undefined;
  return row?.id ?? null;
}
interface ChannelSpec {
  channelType: string; allianceAccess: 'all_alliance' | 'carrier_specific' | null;
  minAllianceTier: string | null; carrierRestriction: string[] | null;
  conditions: object | null; priority: number; confidence: number; sourceUrl: string;
}
function insertChannel(loungeId: number, spec: ChannelSpec): number | null {
  const existing = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = ? AND (alliance_access IS ? OR alliance_access = ?)`)
    .get(loungeId, spec.channelType, spec.allianceAccess, spec.allianceAccess) as { id: number } | undefined;
  if (existing) return null;
  const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, ?, ?)`)
    .run(loungeId, spec.channelType, spec.allianceAccess);
  db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, ?, ?, ?)`)
    .run(chResult.lastInsertRowid, spec.minAllianceTier,
      spec.carrierRestriction ? JSON.stringify(spec.carrierRestriction) : null,
      spec.priority, spec.confidence,
      spec.conditions ? JSON.stringify(spec.conditions) : null,
      spec.sourceUrl, TODAY);
  return Number(chResult.lastInsertRowid);
}
function hours(range: string) {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const obj: Record<string, string[]> = {};
  for (const d of days) obj[d] = [range];
  return JSON.stringify(obj);
}
const RYHMA_1_CHANNELS = (carriers: string[], minTier: string, operatorSource: string): ChannelSpec[] => [
  { channelType: 'alliance_status', allianceAccess: 'carrier_specific', minAllianceTier: minTier, carrierRestriction: carriers, conditions: null, priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 50,  confidence: 0.9,  sourceUrl: operatorSource },
];

const PREMIUM = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];
const FIRST   = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room', 'Spa'];

const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = 'DXB'`).get() as { id: number } | undefined;
if (!airportRow) { console.error('DXB not found'); process.exit(1); }
const airportId = airportRow.id;

db.transaction(() => {
  // ── Step 1: Update EK First Class Lounge (id=14) ───────────────────────
  console.log('=== DXB — Step 1: Enrich EK First Lounge ===');
  const ekFirstOldName = loungeId('DXB', 'Emirates First Class Lounge');
  const ekFirstNewName = loungeId('DXB', 'Emirates First Lounge');
  let ekFirstId: number;
  if (ekFirstNewName) { ekFirstId = ekFirstNewName; console.log(`  ↩ Emirates First Lounge already named — id=${ekFirstId}`); }
  else if (ekFirstOldName) {
    db.prepare(`UPDATE lounges SET name = 'Emirates First Lounge' WHERE id = ?`).run(ekFirstOldName);
    ekFirstId = ekFirstOldName;
    console.log(`  ✓ Renamed "Emirates First Class Lounge" → "Emirates First Lounge" (id=${ekFirstId})`);
  } else { console.error('  ⚠ EK First Lounge not found — aborting'); process.exit(1); }
  const ekFirstChannels: ChannelSpec[] = [
    { channelType: 'alliance_status', allianceAccess: 'carrier_specific', minAllianceTier: 'oneworld_emerald', carrierRestriction: ['QF', 'AY'], conditions: null, priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD },
    { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
    { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
    { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
    { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_EK },
  ];
  for (const ch of ekFirstChannels) {
    const chId = insertChannel(ekFirstId, ch);
    if (chId) console.log(`  ✓ EK First: ${ch.channelType}${ch.allianceAccess ? '/' + ch.allianceAccess : ''}${ch.carrierRestriction ? ' [' + ch.carrierRestriction.join(',') + ']' : ''} (ch=${chId})`);
  }

  // ── Step 2: Update EK Business Class Lounge (id=15) ────────────────────
  console.log('\n=== DXB — Step 2: Enrich EK Business Lounge ===');
  const ekBizOldName = loungeId('DXB', 'Emirates Business Class Lounge');
  const ekBizNewName = loungeId('DXB', 'Emirates Business Lounge');
  let ekBizId: number;
  if (ekBizNewName) { ekBizId = ekBizNewName; console.log(`  ↩ Emirates Business Lounge already named — id=${ekBizId}`); }
  else if (ekBizOldName) {
    db.prepare(`UPDATE lounges SET name = 'Emirates Business Lounge' WHERE id = ?`).run(ekBizOldName);
    ekBizId = ekBizOldName;
    console.log(`  ✓ Renamed "Emirates Business Class Lounge" → "Emirates Business Lounge" (id=${ekBizId})`);
  } else { console.error('  ⚠ EK Business Lounge not found — aborting'); process.exit(1); }
  const ekBizChannels: ChannelSpec[] = [
    { channelType: 'alliance_status', allianceAccess: 'carrier_specific', minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['QF', 'AY'], conditions: null, priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD },
    { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
    { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
    { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
    { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, conditions: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_EK },
  ];
  for (const ch of ekBizChannels) {
    const chId = insertChannel(ekBizId, ch);
    if (chId) console.log(`  ✓ EK Business: ${ch.channelType}${ch.allianceAccess ? '/' + ch.allianceAccess : ''}${ch.carrierRestriction ? ' [' + ch.carrierRestriction.join(',') + ']' : ''} (ch=${chId})`);
  }

  // ── Step 3: Enrich Marhaba (id=24) ──────────────────────────────────────
  console.log('\n=== DXB — Step 3: Enrich Marhaba ===');
  const marhabaId = loungeId('DXB', 'Marhaba Lounge');
  if (!marhabaId) { console.error('  ⚠ Marhaba Lounge not found — aborting'); process.exit(1); }
  const marhabaChannel: ChannelSpec = {
    channelType: 'alliance_status', allianceAccess: 'carrier_specific',
    minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AY', 'AT'],
    conditions: null, priority: 100, confidence: 0.95,
    sourceUrl: `${SOURCE_ONEWORLD} (QR text NOT modeled — see §60)`,
  };
  const chId = insertChannel(marhabaId, marhabaChannel);
  if (chId) console.log(`  ✓ Marhaba: alliance_status/carrier_specific [AY,AT] sapphire (ch=${chId}) — §60 QR nuance TODO`);
  else console.log(`  ↩ Marhaba: alliance_status already exists — skipping`);

  // ── Step 4: Seed 3 new lounges ─────────────────────────────────────────
  console.log('\n=== DXB — Step 4: Seed 3 new lounges ===');

  interface NewLounge {
    name: string; locationDescription: string; openingHours: string | null;
    tier: 'ultra_premium' | 'premium' | 'standard';
    loungeClass: 'first' | 'business' | 'standard';
    amenities: string[]; channels: ChannelSpec[];
  }

  const NEW: NewLounge[] = [
    {
      name: 'British Airways Lounge (T1)',
      locationDescription: 'Terminal 1, Concourse D, 1st floor, after security',
      openingHours: hours('06:30 - 13:30'),  // §61: 2nd shift 21:30-02:30 omitted until engine verified
      tier: 'premium', loungeClass: 'business', amenities: PREMIUM,
      // BA outstation — [BA] only, no §36 (no wider-access wording)
      channels: RYHMA_1_CHANNELS(['BA'], 'oneworld_sapphire', SOURCE_BA),
    },
    {
      name: 'Ahlan Business Class Lounge',
      locationDescription: 'Terminal 1, after security',
      openingHours: hours('00:00 - 23:59'),  // 24h
      tier: 'premium', loungeClass: 'business', amenities: PREMIUM,
      channels: RYHMA_1_CHANNELS(['CX', 'RJ', 'UL', 'AY'], 'oneworld_sapphire', SOURCE_AHLAN),  // §36
    },
    {
      name: 'Ahlan First Class Lounge',
      locationDescription: 'Terminal 1, after security',
      openingHours: null,
      tier: 'ultra_premium', loungeClass: 'first', amenities: FIRST,
      // §52 OR-model: emerald floor, no cabin
      channels: RYHMA_1_CHANNELS(['CX', 'QR', 'AY'], 'oneworld_emerald', SOURCE_AHLAN),  // §36
    },
  ];

  for (const spec of NEW) {
    const existing = loungeId('DXB', spec.name);
    let id: number;
    if (existing) { id = existing; console.log(`  ↩ ${spec.name}: id=${id} — skip insert`); }
    else {
      const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, ?, ?, ?, 'all', ?, ?)`)
        .run(airportId, spec.name, spec.locationDescription, spec.tier, spec.loungeClass,
             spec.openingHours, JSON.stringify(spec.amenities));
      id = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.name} (id=${id})`);
    }
    for (const ch of spec.channels) {
      const chIdNew = insertChannel(id, ch);
      if (chIdNew) {
        const note = ch.carrierRestriction ? ` [${ch.carrierRestriction.join(',')}]` : '';
        console.log(`    ✓ ${ch.channelType}${ch.allianceAccess ? '/' + ch.allianceAccess : ''}${note} (ch=${chIdNew})`);
      }
    }
  }

  console.log('\nDXB review complete.');
})();
db.close();
