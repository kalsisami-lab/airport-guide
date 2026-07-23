/**
 * §52 tier-migration follow-up + AMS §51/opening-hours corrections.
 *
 * Two independent audit results shipped together:
 *
 * ── Part 1: §52 First-class tier gate (7 lounges) ───────────────────────
 *
 * §51 audit surfaced systematic Phase 30/31 pattern: Ryhmä 2 lounges
 * were seeded uniformly with min_alliance_tier = oneworld_sapphire
 * regardless of lounge_class. Scrape data shows tiers = ["emerald"]
 * for these — sapphire holders should be DENIED, not allowed. Migrate:
 *
 *   HKG  Cathay Pacific The Pier, First          Phase 31 seed
 *   HKG  Cathay Pacific The Wing, First          Phase 31 seed
 *   NRT  Japan Airlines First Class Lounge       Phase 31 seed
 *   HND  Japan Airlines First Class Lounge       Phase 31 seed
 *   LAX  Qantas First Lounge                     Phase 31 seed
 *   MEL  Qantas International First              Phase 31 seed
 *   MEL  Qantas Domestic Business                Phase 31 seed (unusual —
 *                                                business_class named but
 *                                                scrape tiers = [emerald],
 *                                                trust scrape)
 *
 * Change: min_alliance_tier oneworld_sapphire → oneworld_emerald. No
 * other channel/rule changes.
 *
 * DFW/ORD/LAX/MIA AA Flagship Lounges NOT migrated — scrape tiers
 * [sapphire/emerald] means current oneworld_sapphire floor is correct.
 * JFK AA Flagship Lounge already emerald from Phase 30.
 *
 * ── Part 2: AMS oneworld Lounge (No.40) — Ryhmä 1 → Ryhmä 2 (§51) ──────
 *
 * User verified wording on oneworld.com:
 *   "Access for eligible customers traveling on ANY oneworld member
 *    airline" → §51 Ryhmä 2 all_alliance
 *   Tiers: Business, First, Sapphire, Emerald → oneworld_sapphire floor
 *     (not emerald — §52 not applicable here)
 *
 * Batch 3c (PR #8) seeded this as Ryhmä 1 carrier_specific [AA,BA,CX,
 * WY,QR,AT,RJ,AY] + PP/LK/DP/paid. Wrong per §51. Migrate:
 *   Delete all 5 Ryhmä 1 channels + rules
 *   Insert single all_alliance/oneworld_sapphire channel + rule
 *   area='non_schengen' already correct (data: "Non-Schengen Area,
 *     between D & E Gates, 3rd floor, after security")
 *   opening_hours set to "Daily 05:30-22:00"
 *
 * ── Part 3: AMS Aspire Lounge (No.26) — verify + opening hours ────────
 *
 * User-provided wording: "THESE oneworld member airlines only" +
 * [Finnair, Iberia] → carrier_specific [AY, IB], area='schengen'.
 * Current model matches — no channel changes. Set opening_hours to
 * "Daily 06:00-21:00 (doors close 20:30)".
 *
 * Zone note (AMS unique constraint): the Schengen/non-Schengen split
 * matters at AMS because both zones exist behind separate immigration
 * controls. Post-patch:
 *   Schengen-departing pax + oneworld Lounge (No.40, non_schengen) →
 *     physically_unreachable
 *   Non-Schengen-departing pax + Aspire (No.26, schengen) →
 *     physically_unreachable
 *   Non-Schengen-departing JL Sapphire + oneworld Lounge → allowed
 *     (Ryhmä 2 all_alliance, was previously paid_available under Ryhmä 1
 *     because JL wasn't on the carrier list)
 *
 * Sources:
 *   oneworld.com/airport-lounge-results (scrape output tiers field —
 *     §52 evidence)
 *   oneworld.com/airport-lounge-results?location=AMS (user's manual
 *     wording verification for §51)
 *
 * Idempotent: skips channels/rules that already match target state.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';

// ─── Helper: find lounge by (iata, name) ──────────────────────────────────
function loungeId(iata: string, name: string): number | null {
  const row = db.prepare(`
    SELECT l.id FROM lounges l JOIN airports a ON a.id = l.airport_id
    WHERE a.iata_code = ? AND l.name = ?
  `).get(iata, name) as { id: number } | undefined;
  return row?.id ?? null;
}

// ─── Part 1: §52 tier gate migration ──────────────────────────────────────
const TIER_MIGRATIONS: Array<{ iata: string; name: string }> = [
  { iata: 'HKG', name: 'Cathay Pacific The Pier, First' },
  { iata: 'HKG', name: 'Cathay Pacific The Wing, First' },
  { iata: 'NRT', name: 'Japan Airlines First Class Lounge' },
  { iata: 'HND', name: 'Japan Airlines First Class Lounge' },
  { iata: 'LAX', name: 'Qantas First Lounge' },
  { iata: 'MEL', name: 'Qantas International First' },
  { iata: 'MEL', name: 'Qantas Domestic Business' },
];

// ─── Main transaction ─────────────────────────────────────────────────────
db.transaction(() => {
  console.log('=== Part 1: §52 tier migration (sapphire → emerald) ===');
  let migrated = 0, unchanged = 0;
  for (const spec of TIER_MIGRATIONS) {
    const id = loungeId(spec.iata, spec.name);
    if (!id) {
      console.log(`  ⚠ ${spec.iata} ${spec.name}: not found — skipping`);
      continue;
    }
    // Find the all_alliance rule
    const rule = db.prepare(`
      SELECT r.id, r.min_alliance_tier FROM lounge_access_rules r
      JOIN lounge_access_channels c ON c.id = r.channel_id
      WHERE c.lounge_id = ? AND c.channel_type = 'alliance_status'
        AND c.alliance_access = 'all_alliance'
    `).get(id) as { id: number; min_alliance_tier: string } | undefined;
    if (!rule) {
      console.log(`  ⚠ ${spec.iata} ${spec.name} (id=${id}): no all_alliance rule found — skipping`);
      continue;
    }
    if (rule.min_alliance_tier === 'oneworld_emerald') {
      console.log(`  ↩ ${spec.iata} ${spec.name}: already emerald — skip`);
      unchanged++;
      continue;
    }
    db.prepare(`UPDATE lounge_access_rules SET min_alliance_tier = 'oneworld_emerald', verified_at = ? WHERE id = ?`)
      .run(TODAY, rule.id);
    console.log(`  ✓ ${spec.iata} ${spec.name} (id=${id}): min_tier ${rule.min_alliance_tier} → oneworld_emerald (rule id=${rule.id})`);
    migrated++;
  }
  console.log(`  Result: migrated=${migrated} unchanged=${unchanged}`);

  // ─── Part 2: AMS oneworld Lounge (No.40) migration ──────────────────────
  console.log('\n=== Part 2: AMS oneworld Lounge (No.40) — Ryhmä 1 → Ryhmä 2 (§51) ===');
  const amsOneworldId = loungeId('AMS', 'oneworld Lounge (Lounge No.40)');
  if (!amsOneworldId) {
    console.error('  ⚠ AMS oneworld Lounge (Lounge No.40) not found — aborting');
    process.exit(1);
  }

  // Check if already migrated
  const existingAllAlliance = db.prepare(`
    SELECT id FROM lounge_access_channels
    WHERE lounge_id = ? AND channel_type = 'alliance_status' AND alliance_access = 'all_alliance'
  `).get(amsOneworldId) as { id: number } | undefined;

  if (existingAllAlliance) {
    console.log(`  ↩ AMS oneworld Lounge: all_alliance channel already exists (ch=${existingAllAlliance.id}) — skipping migration`);
  } else {
    // Delete all existing channels + their rules
    const oldChannels = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ?`).all(amsOneworldId) as { id: number }[];
    for (const ch of oldChannels) {
      db.prepare(`DELETE FROM lounge_access_rules WHERE channel_id = ?`).run(ch.id);
      db.prepare(`DELETE FROM lounge_access_channels WHERE id = ?`).run(ch.id);
    }
    console.log(`  ✗ AMS oneworld Lounge: deleted ${oldChannels.length} old Ryhmä 1 channel(s) + rules`);

    // Insert single all_alliance/oneworld_sapphire channel + rule
    const newCh = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, 'alliance_status', 'all_alliance')`).run(amsOneworldId);
    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to,
         priority, confidence, conditions, source_url, verified_at)
      VALUES (?, 'oneworld_sapphire', NULL, '2020-01-01', NULL, 100, 0.99, NULL, ?, ?)
    `).run(newCh.lastInsertRowid, `${SOURCE_ONEWORLD}?location=AMS`, TODAY);
    console.log(`  ✓ AMS oneworld Lounge: migrated to all_alliance/oneworld_sapphire (ch=${newCh.lastInsertRowid})`);
  }

  // Update opening hours regardless
  const amsOneworldHours = JSON.stringify({
    Sunday: ['05:30 - 22:00'], Monday: ['05:30 - 22:00'], Tuesday: ['05:30 - 22:00'],
    Wednesday: ['05:30 - 22:00'], Thursday: ['05:30 - 22:00'],
    Friday: ['05:30 - 22:00'], Saturday: ['05:30 - 22:00'],
  });
  db.prepare(`UPDATE lounges SET opening_hours = ? WHERE id = ?`).run(amsOneworldHours, amsOneworldId);
  console.log(`  ✓ AMS oneworld Lounge: opening_hours set to Daily 05:30-22:00`);

  // ─── Part 3: AMS Aspire Lounge (No.26) — verify + opening hours ─────────
  console.log('\n=== Part 3: AMS Aspire Lounge (No.26) — verify + opening hours ===');
  const amsAspireId = loungeId('AMS', 'Aspire Lounge (No.26)');
  if (!amsAspireId) {
    console.error('  ⚠ AMS Aspire Lounge (No.26) not found — aborting');
    process.exit(1);
  }
  // Sanity-check existing model
  const aspireRule = db.prepare(`
    SELECT r.carrier_restriction, c.alliance_access
    FROM lounge_access_rules r
    JOIN lounge_access_channels c ON c.id = r.channel_id
    WHERE c.lounge_id = ? AND c.channel_type = 'alliance_status'
  `).get(amsAspireId) as { carrier_restriction: string; alliance_access: string } | undefined;
  if (aspireRule) {
    const carriers = JSON.parse(aspireRule.carrier_restriction) as string[];
    const isCorrect = aspireRule.alliance_access === 'carrier_specific'
      && carriers.length === 2
      && carriers.includes('AY') && carriers.includes('IB');
    console.log(`  ${isCorrect ? '✓' : '⚠'} AMS Aspire model: alliance_access=${aspireRule.alliance_access}, carriers=[${carriers.join(',')}] ${isCorrect ? '(correct per user spec)' : '(MISMATCH — investigate)'}`);
  }
  const aspireArea = db.prepare(`SELECT area FROM lounges WHERE id = ?`).get(amsAspireId) as { area: string } | undefined;
  console.log(`  ${aspireArea?.area === 'schengen' ? '✓' : '⚠'} AMS Aspire area: ${aspireArea?.area} ${aspireArea?.area === 'schengen' ? '(correct)' : '(should be schengen)'}`);

  const amsAspireHours = JSON.stringify({
    Sunday: ['06:00 - 21:00'], Monday: ['06:00 - 21:00'], Tuesday: ['06:00 - 21:00'],
    Wednesday: ['06:00 - 21:00'], Thursday: ['06:00 - 21:00'],
    Friday: ['06:00 - 21:00'], Saturday: ['06:00 - 21:00'],
  });
  db.prepare(`UPDATE lounges SET opening_hours = ? WHERE id = ?`).run(amsAspireHours, amsAspireId);
  console.log(`  ✓ AMS Aspire Lounge: opening_hours set to Daily 06:00-21:00 (doors close 20:30 not modeled)`);

  console.log('\nPatch complete.');
})();

db.close();
