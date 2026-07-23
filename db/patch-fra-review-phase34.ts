/**
 * Phase 34: FRA review — delete demo data, update Primeclass, seed 3 new oneworld lounges.
 *
 * Manual data collection from oneworld.com/airport-lounge-results?location=FRA
 * plus §51 wording-based classification.
 *
 * FRA had been deferred from earlier batches (3c, Ryhmä 3) because of
 * pre-baseline demo data mixed with real Star Alliance / PP-only lounges.
 * This patch reconciles them.
 *
 * ── Part 1: Delete demo data (§57) ────────────────────────────────────────
 *
 * JAL Sakura Lounge FRA (id=5) and Qatar Airways Business Lounge FRA (id=6)
 * are NOT on oneworld.com's FRA list. JAL uses LH Senator under codeshare;
 * QR passengers use the third-party Priority Lounge (T2) here. Both entries
 * were incorrect pre-baseline demo data. Deleted.
 *
 * ── Part 2: Update Primeclass Business Lounge (id=22) → Primeclass Lounge
 *
 * Existing pre-baseline entry "Primeclass Business Lounge" (T2, schengen,
 * only PP + LK channels) matches the new oneworld.com entry "Primeclass
 * Lounge" — same brand, same T2, same "After Security". Reconciliation:
 *   - Rename: "Primeclass Business Lounge" → "Primeclass Lounge"
 *   - Add alliance_status/carrier_specific [AT, AY] (§36) — new
 *   - Add dragon_pass channel — new
 *   - Add paid channel — new
 *   - Keep existing PP + LK channels (idempotent, no changes)
 *   - Update opening_hours to "24h"
 *   - Keep area='schengen' (§58: no better source data)
 *
 * ── Part 3: Seed 3 new oneworld lounges ───────────────────────────────────
 *
 *   Air France/KLM Lounge  (T2, opposite D26-D27)
 *     Ryhmä 3 (AMBIG) — non-oneworld operator (AF is SkyTeam), fixed
 *     carrier list [IB]. NO §36 (contract, not seasonal — same shape as
 *     CDG Air France Lounge, MUC AF/KLM Lounge from Ryhmä 3 batch).
 *     area='non_schengen' (§58: inferred from D26-D27).
 *     Opening hours: 05:45-20:30 daily.
 *
 *   Priority Lounge (T2)   (Gate E9)
 *     Ryhmä 1 — carrier_specific [QR] + §36 AY → [QR, AY].
 *     5-channel model (oneworld + PP + LK + DP + paid).
 *     area='non_schengen' (§58: E-gates are non-Schengen).
 *     Opening hours: 06:30-19:30 daily.
 *
 *   Priority Lounge (T3)   (Level 5, Building 602)
 *     Ryhmä 1 — carrier_specific [AA, BA, CX, JL] + §36 AY.
 *     5-channel model.
 *     area='non_schengen' (§58: T3 is international-oriented).
 *     Opening hours: 06:00-21:00 daily.
 *
 * Name uniqueness: two "Priority Lounge" lounges disambiguated by "(T2)"
 * and "(T3)" suffix to satisfy the (airport_id, name) unique index.
 *
 * ── NOT touched ───────────────────────────────────────────────────────────
 *
 *   Aspire Lounge (id=23)                — kept as-is (PP-only, not on
 *                                          oneworld list, legit PP entry)
 *   Lufthansa First Class Lounge (id=9)  — kept (Star Alliance, real)
 *   Lufthansa Senator Lounge (id=7, 8)   — kept (Star Alliance, real)
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=FRA
 *     (user's manual verification, 2026-07)
 *   https://wwws.airfrance.com  (Air France/KLM operator)
 *   https://www.plazapremiumlounge.com  (Primeclass is a Plaza Premium brand)
 *   https://www.tavlounges.com  (Priority Lounge operator, TAV Group)
 *
 * Idempotent: delete steps skip if already gone; update steps skip if
 * already in target state; insert steps skip by (airport_id, name).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results?location=FRA';
const SOURCE_AF       = 'https://wwws.airfrance.com';
const SOURCE_PLAZA    = 'https://www.plazapremiumlounge.com';
const SOURCE_TAV      = 'https://www.tavlounges.com';
const SOURCE_PP       = 'https://www.prioritypass.com';

// ─── Helper: find lounge by (iata, name) ──────────────────────────────────
function loungeId(iata: string, name: string): number | null {
  const row = db.prepare(`
    SELECT l.id FROM lounges l JOIN airports a ON a.id = l.airport_id
    WHERE a.iata_code = ? AND l.name = ?
  `).get(iata, name) as { id: number } | undefined;
  return row?.id ?? null;
}

// ─── Helper: delete lounge + its channels + rules ─────────────────────────
function deleteLounge(id: number): number {
  const channels = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ?`).all(id) as { id: number }[];
  for (const ch of channels) {
    db.prepare(`DELETE FROM lounge_access_rules WHERE channel_id = ?`).run(ch.id);
    db.prepare(`DELETE FROM lounge_access_channels WHERE id = ?`).run(ch.id);
  }
  db.prepare(`DELETE FROM lounges WHERE id = ?`).run(id);
  return channels.length;
}

// ─── Helper: insert channel + rule ────────────────────────────────────────
interface ChannelSpec {
  channelType: string;
  allianceAccess: 'all_alliance' | 'carrier_specific' | null;
  minAllianceTier: string | null;
  carrierRestriction: string[] | null;
  priority: number;
  confidence: number;
  sourceUrl: string;
}

function insertChannel(loungeId: number, spec: ChannelSpec): number {
  const existing = db.prepare(`
    SELECT id FROM lounge_access_channels
    WHERE lounge_id = ? AND channel_type = ? AND (alliance_access IS ? OR alliance_access = ?)
  `).get(loungeId, spec.channelType, spec.allianceAccess, spec.allianceAccess) as { id: number } | undefined;
  if (existing) return existing.id;
  const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, ?, ?)`)
    .run(loungeId, spec.channelType, spec.allianceAccess);
  db.prepare(`
    INSERT INTO lounge_access_rules
      (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to,
       priority, confidence, conditions, source_url, verified_at)
    VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, NULL, ?, ?)
  `).run(chResult.lastInsertRowid,
    spec.minAllianceTier,
    spec.carrierRestriction ? JSON.stringify(spec.carrierRestriction) : null,
    spec.priority, spec.confidence, spec.sourceUrl, TODAY);
  return Number(chResult.lastInsertRowid);
}

// Opening hours JSON factory
function hours(range: string) {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const obj: Record<string, string[]> = {};
  for (const d of days) obj[d] = [range];
  return JSON.stringify(obj);
}

// Ryhmä 1 5-channel factory
const RYHMA_1_CHANNELS = (carriers: string[], operatorSource: string): ChannelSpec[] => [
  { channelType: 'alliance_status', allianceAccess: 'carrier_specific', minAllianceTier: 'oneworld_sapphire', carrierRestriction: carriers, priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD },
  { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
  { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
  { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
  { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: operatorSource },
];

const PREMIUM = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = 'FRA'`).get() as { id: number } | undefined;
if (!airportRow) { console.error('FRA airport not found — aborting'); process.exit(1); }
const airportId = airportRow.id;

db.transaction(() => {
  // ── Part 1: Delete demo data ──────────────────────────────────────────────
  console.log('=== Part 1: Delete demo data (§57) ===');
  const jalId = loungeId('FRA', 'Japan Airlines Sakura Lounge');
  if (jalId) {
    const n = deleteLounge(jalId);
    console.log(`  ✗ Deleted JAL Sakura Lounge FRA (id=${jalId}) + ${n} channels/rules`);
  } else console.log('  ↩ JAL Sakura Lounge FRA already gone');

  const qrId = loungeId('FRA', 'Qatar Airways Business Lounge');
  if (qrId) {
    const n = deleteLounge(qrId);
    console.log(`  ✗ Deleted QR Business Lounge FRA (id=${qrId}) + ${n} channels/rules`);
  } else console.log('  ↩ QR Business Lounge FRA already gone');

  // ── Part 2: Rename + enrich Primeclass ─────────────────────────────────────
  console.log('\n=== Part 2: Rename + enrich Primeclass (id=22) ===');
  const oldPrimeclassId = loungeId('FRA', 'Primeclass Business Lounge');
  const newPrimeclassId = loungeId('FRA', 'Primeclass Lounge');
  let primeclassId: number;

  if (newPrimeclassId) {
    primeclassId = newPrimeclassId;
    console.log(`  ↩ "Primeclass Lounge" already exists (id=${primeclassId}) — skip rename`);
  } else if (oldPrimeclassId) {
    db.prepare(`UPDATE lounges SET name = 'Primeclass Lounge', opening_hours = ? WHERE id = ?`)
      .run(hours('00:00 - 23:59'), oldPrimeclassId);
    primeclassId = oldPrimeclassId;
    console.log(`  ✓ Renamed "Primeclass Business Lounge" → "Primeclass Lounge" (id=${primeclassId}), opening_hours → 24h`);
  } else {
    console.error('  ⚠ Neither "Primeclass Business Lounge" nor "Primeclass Lounge" exists — aborting');
    process.exit(1);
  }
  // Also update opening hours even if renaming was skipped
  db.prepare(`UPDATE lounges SET opening_hours = ? WHERE id = ?`).run(hours('00:00 - 23:59'), primeclassId);

  // Add oneworld carrier_specific + DP + paid channels (keep existing PP + LK)
  const primeclassChannels: ChannelSpec[] = [
    { channelType: 'alliance_status', allianceAccess: 'carrier_specific', minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AT', 'AY'], priority: 100, confidence: 0.95, sourceUrl: SOURCE_ONEWORLD },  // §36
    { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
    { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_PLAZA },
  ];
  for (const ch of primeclassChannels) {
    const chId = insertChannel(primeclassId, ch);
    console.log(`  ✓ Primeclass ${ch.channelType}${ch.allianceAccess ? '/' + ch.allianceAccess : ''}${ch.carrierRestriction ? ' [' + ch.carrierRestriction.join(',') + ']' : ''} (ch=${chId})`);
  }

  // ── Part 3: Seed 3 new lounges ─────────────────────────────────────────────
  console.log('\n=== Part 3: Seed 3 new oneworld lounges ===');

  interface NewLounge {
    name: string; area: 'schengen' | 'non_schengen' | 'international' | 'all';
    locationDescription: string; openingHoursRange: string;
    tier: 'ultra_premium' | 'premium' | 'standard';
    loungeClass: 'first' | 'business' | 'standard';
    channels: ChannelSpec[];
  }

  const NEW_LOUNGES: NewLounge[] = [
    {
      name: 'Air France/KLM Lounge',
      area: 'non_schengen',
      locationDescription: 'Terminal 2, opposite Gates D26-D27, after security',
      openingHoursRange: '05:45 - 20:30',
      tier: 'premium', loungeClass: 'business',
      // Ryhmä 3 AMBIG — single alliance_status/carrier_specific channel, NO §36
      channels: [{
        channelType: 'alliance_status', allianceAccess: 'carrier_specific',
        minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['IB'],
        priority: 100, confidence: 0.95, sourceUrl: `${SOURCE_ONEWORLD} + ${SOURCE_AF}`,
      }],
    },
    {
      name: 'Priority Lounge (T2)',
      area: 'non_schengen',
      locationDescription: 'Terminal 2, Gate E9, after security',
      openingHoursRange: '06:30 - 19:30',
      tier: 'premium', loungeClass: 'business',
      channels: RYHMA_1_CHANNELS(['QR', 'AY'], SOURCE_TAV),  // §36
    },
    {
      name: 'Priority Lounge (T3)',
      area: 'non_schengen',
      locationDescription: 'Terminal 3, Level 5, Building 602, after security',
      openingHoursRange: '06:00 - 21:00',
      tier: 'premium', loungeClass: 'business',
      channels: RYHMA_1_CHANNELS(['AA', 'BA', 'CX', 'JL', 'AY'], SOURCE_TAV),  // §36
    },
  ];

  for (const spec of NEW_LOUNGES) {
    const existing = loungeId('FRA', spec.name);
    let id: number;
    if (existing) {
      id = existing;
      console.log(`  ↩ ${spec.name}: id=${id} — skip insert`);
    } else {
      const result = db.prepare(`
        INSERT INTO lounges (airport_id, terminal_id, name, location_description,
          tier, lounge_class, area, opening_hours, amenities)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(airportId, spec.name, spec.locationDescription, spec.tier, spec.loungeClass,
        spec.area, hours(spec.openingHoursRange), JSON.stringify(PREMIUM));
      id = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.name} (id=${id}, area=${spec.area})`);
    }
    for (const ch of spec.channels) {
      const chId = insertChannel(id, ch);
      const carrierNote = ch.carrierRestriction ? ` [${ch.carrierRestriction.join(',')}]` : '';
      console.log(`    ✓ ${ch.channelType}${ch.allianceAccess ? '/' + ch.allianceAccess : ''}${carrierNote} (ch=${chId})`);
    }
  }

  console.log('\nFRA review patch complete.');
})();

db.close();
