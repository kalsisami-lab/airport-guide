/**
 * Phase 35 (JFK part): review — delete demo, update Admirals, seed 4 new.
 *
 * Manual data from oneworld.com/airport-lounge-results?location=JFK +
 * §51 wording classification + §52 First-Class/Emerald-Tier reading +
 * user field verification of Chelsea/Soho on 2026-07 trip.
 *
 * ── Delete demo entry ────────────────────────────────────────────────────
 *
 *   American Airlines Flagship Lounge (id=12) — pre-baseline demo,
 *     no longer matches oneworld.com's JFK T8 structure. The T8
 *     consolidation (BA + AA joint terminal) split the old Flagship
 *     into three specialized lounges: Chelsea (First-cabin),
 *     Greenwich (Sapphire), Soho (Emerald). Deleted; replaced by
 *     three new entries below.
 *
 * ── Update ───────────────────────────────────────────────────────────────
 *
 *   American Airlines Admirals Club (id=13):
 *     - Opening hours 05:30-23:00 → 04:15-22:30 (per oneworld.com)
 *     - location_description updated: "Terminal 8, Concourse C,
 *       opposite Gate 42, after security"
 *     - Model unchanged (all_alliance + oneworld_sapphire is §51/§52
 *       correct — "ANY oneworld" wording)
 *
 * ── Seed new ─────────────────────────────────────────────────────────────
 *
 *   BA/AA Chelsea Lounge (T8) — §52 AND-type, §56/§62 field-verified
 *     Data: "First Class" without "Emerald Tier" line + named program
 *     cards (BA Gold 65k tier points / AA Concierge Key). User's field
 *     report 2026-07: Finnair Platinum (Emerald) + AY Business → NOT
 *     admitted. Modeled as airline_own [AA,BA] + cabin='first', no
 *     min_tier. Same shape as LHR BA Concorde Room (Phase #6) and
 *     DOH Al Safwa First Lounge. Hours 04:15-23:30.
 *
 *   BA/AA Greenwich Lounge (T8) — Ryhmä 1, §51 "THESE only"
 *     Carrier list [AA, BA, CX, AY, IB, JL, QF, QR, RJ]. AY already
 *     listed → NO §36 addition. min_tier oneworld_sapphire. Standard
 *     5-channel Ryhmä 1. Hours 04:15-01:15.
 *
 *   BA/AA Soho Lounge (T8) — Ryhmä 1 emerald, §52 OR-model, §62 field-verified
 *     Same 9-carrier list as Greenwich. Data shows "First Class" AND
 *     "Emerald Tier" as separate lines → OR-model, emerald tier alone
 *     qualifies on Business ticket. User's field report 2026-07 same
 *     trip: Finnair Platinum (Emerald) + AY Business → ADMITTED.
 *     min_tier oneworld_emerald. Standard 5-channel. Hours 04:15-23:30.
 *
 *   Primeclass Lounge (T1) — Ryhmä 1 sapphire, §36
 *     Carrier list [AT] on oneworld.com → §36 adds AY → [AT, AY].
 *     Standard 5-channel Ryhmä 1. Opening hours not explicitly given
 *     in source (T1 general lounge hours — set to null with §-note).
 *
 * ── Not touched ──────────────────────────────────────────────────────────
 *   Centurion Lounge (id=20) — Amex-only, legit
 *   Wingtips Lounge (id=21) — PP-network, legit
 *
 * area='all' throughout (JFK is outside Schengen, no zone split).
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=JFK (manual)
 *   User field-verified Chelsea/Soho 2026-07-23
 *   https://www.aa.com/flagship-lounge
 *   https://www.britishairways.com/en-gb/information/at-the-airport/lounges
 *
 * Idempotent per (airport_id, name). Field-verified points marked in
 * source_url for traceability.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results?location=JFK';
const SOURCE_AA       = 'https://www.aa.com';
const SOURCE_BA       = 'https://www.britishairways.com/en-gb/information/at-the-airport/lounges';
const SOURCE_PLAZA    = 'https://www.plazapremiumlounge.com';
const SOURCE_PP       = 'https://www.prioritypass.com';
const FIELD_VERIFIED  = 'FIELD_VERIFIED: 2026-07-23 user trip (Finnair Platinum + AY Business)';

// Helper
function loungeId(iata: string, name: string): number | null {
  const row = db.prepare(`SELECT l.id FROM lounges l JOIN airports a ON a.id = l.airport_id WHERE a.iata_code = ? AND l.name = ?`).get(iata, name) as { id: number } | undefined;
  return row?.id ?? null;
}
function deleteLounge(id: number): number {
  const channels = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ?`).all(id) as { id: number }[];
  for (const ch of channels) {
    db.prepare(`DELETE FROM lounge_access_rules WHERE channel_id = ?`).run(ch.id);
    db.prepare(`DELETE FROM lounge_access_channels WHERE id = ?`).run(ch.id);
  }
  db.prepare(`DELETE FROM lounges WHERE id = ?`).run(id);
  return channels.length;
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

const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = 'JFK'`).get() as { id: number } | undefined;
if (!airportRow) { console.error('JFK not found'); process.exit(1); }
const airportId = airportRow.id;

db.transaction(() => {
  // ── Step 1: Delete Flagship Lounge legacy ───────────────────────────────
  console.log('=== JFK — Step 1: Delete legacy demo ===');
  const flagshipId = loungeId('JFK', 'American Airlines Flagship Lounge');
  if (flagshipId) {
    const n = deleteLounge(flagshipId);
    console.log(`  ✗ Deleted AA Flagship Lounge JFK (id=${flagshipId}) + ${n} channels/rules`);
  } else console.log('  ↩ AA Flagship Lounge JFK already gone');

  // ── Step 2: Update AA Admirals Club (id=13) ────────────────────────────
  console.log('\n=== JFK — Step 2: Update AA Admirals Club ===');
  const admiralsId = loungeId('JFK', 'American Airlines Admirals Club');
  if (admiralsId) {
    db.prepare(`UPDATE lounges SET location_description = ?, opening_hours = ? WHERE id = ?`)
      .run('Terminal 8, Concourse C, opposite Gate 42, after security', hours('04:15 - 22:30'), admiralsId);
    console.log(`  ✓ AA Admirals Club (id=${admiralsId}): location + hours updated to 04:15-22:30`);
  } else console.log('  ⚠ AA Admirals Club not found — skipping update');

  // ── Step 3: Seed new lounges ────────────────────────────────────────────
  console.log('\n=== JFK — Step 3: Seed new lounges ===');

  interface NewLounge {
    name: string; locationDescription: string; openingHours: string | null;
    tier: 'ultra_premium' | 'premium' | 'standard';
    loungeClass: 'first' | 'business' | 'standard';
    amenities: string[]; channels: ChannelSpec[];
  }

  const NEW_LOUNGES: NewLounge[] = [
    {
      name: 'BA/AA Chelsea Lounge',
      locationDescription: 'Terminal 8, joint BA/AA facility, after security',
      openingHours: hours('04:15 - 23:30'),
      tier: 'ultra_premium', loungeClass: 'first', amenities: FIRST,
      // §52 AND-type + §62 field-verified: airline_own + cabin='first', no min_tier
      channels: [{
        channelType: 'airline_own', allianceAccess: null,
        minAllianceTier: null, carrierRestriction: ['AA', 'BA'],
        conditions: { op: 'equals', field: 'passenger.cabin', value: 'first' },
        priority: 100, confidence: 0.99,
        sourceUrl: `${SOURCE_ONEWORLD} + ${FIELD_VERIFIED}`,
      }],
    },
    {
      name: 'BA/AA Greenwich Lounge',
      locationDescription: 'Terminal 8, joint BA/AA facility, after security',
      openingHours: hours('04:15 - 01:15'),
      tier: 'premium', loungeClass: 'business', amenities: PREMIUM,
      // Ryhmä 1 sapphire, AY already on list (no §36)
      channels: RYHMA_1_CHANNELS(['AA', 'BA', 'CX', 'AY', 'IB', 'JL', 'QF', 'QR', 'RJ'], 'oneworld_sapphire', SOURCE_BA),
    },
    {
      name: 'BA/AA Soho Lounge',
      locationDescription: 'Terminal 8, joint BA/AA facility, after security',
      openingHours: hours('04:15 - 23:30'),
      tier: 'ultra_premium', loungeClass: 'first', amenities: FIRST,
      // §52 OR-model + §62 field-verified: emerald floor, no cabin condition
      channels: RYHMA_1_CHANNELS(['AA', 'BA', 'CX', 'AY', 'IB', 'JL', 'QF', 'QR', 'RJ'], 'oneworld_emerald',
        `${SOURCE_BA} + ${FIELD_VERIFIED}`),
    },
    {
      name: 'Primeclass Lounge',
      locationDescription: 'Terminal 1, after security',
      openingHours: null,
      tier: 'premium', loungeClass: 'business', amenities: PREMIUM,
      channels: RYHMA_1_CHANNELS(['AT', 'AY'], 'oneworld_sapphire', SOURCE_PLAZA),  // §36
    },
  ];

  for (const spec of NEW_LOUNGES) {
    const existing = loungeId('JFK', spec.name);
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
      const chId = insertChannel(id, ch);
      if (chId) {
        const note = ch.carrierRestriction ? ` [${ch.carrierRestriction.join(',')}]` : '';
        const cond = ch.conditions ? ` +cabin` : '';
        console.log(`    ✓ ${ch.channelType}${ch.allianceAccess ? '/' + ch.allianceAccess : ''}${note}${cond} (ch=${chId})`);
      }
    }
  }

  console.log('\nJFK review complete.');
})();
db.close();
