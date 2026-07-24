/**
 * Seed Centurion Lounges at 7 airports already in the DB.
 * Also renames ARN "American Express Lounge" → "The Centurion Lounge"
 * (same physical lounge, unified branding).
 *
 * Source data: scripts/data/centurion-lounges.json (Amex network snapshot
 * verified 2026-07-24 from americanexpress.com/travel/centurion-lounge).
 *
 * Scope: only airports that are already in the airports table.
 * Skipped:
 *   - JFK, LHR: Centurion already seeded (pre-baseline)
 *   - ARN: renamed only (Centurion already existed as "American Express Lounge")
 *   - DEL: airport in table but 0 lounges seeded (§66 data gap — seed
 *     Centurion together with the full DEL lounge set later, not as a
 *     lonely single-lounge entry)
 *   - 16 other Centurion network airports (ATL, CLT, DEN, IAH, LAS, LGA,
 *     PHL, PHX, SLC, SFO, DCA, EZE, MEX, MTY, BOM, SYD) — not in airports
 *     table. Scope expansion (§66).
 *
 * Model per lounge:
 *   - Single amex_centurion channel (no PP/LK/DP — Centurion is NOT on
 *     the Priority Pass network; Amex Platinum is the sole access path).
 *   - No alliance channel — Centurion is card-based, not tier-based.
 *   - Terminal info in location_description.
 *   - lounge_class='business', tier='premium' (uniform for Centurion brand).
 *   - area='all' (Centurion lounges typically pre-security or unified areas;
 *     no Schengen zone splits at these airports).
 *
 * Idempotent per (airport_id, name).
 */
import Database from 'better-sqlite3';
import path from 'path';
import * as fs from 'node:fs';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = '2026-07-24';

const SOURCE_URL = 'https://www.americanexpress.com/en-us/travel/centurion-lounge';

// Airports we WILL seed (already in DB, no Centurion, has other lounges)
const SEED_IATAS = new Set(['DFW', 'LAX', 'MIA', 'SEA', 'HKG', 'MEL', 'HND']);
// ARN gets a rename, not a new insert
const ARN_RENAME = { from: 'American Express Lounge', to: 'The Centurion Lounge' };

const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts/data/centurion-lounges.json'), 'utf-8'));
const CENTURION_LOUNGES = raw.lounges as Array<{ iata: string; name: string; terminal: string | null; source: string }>;

const PREMIUM_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

db.transaction(() => {
  console.log('=== Part 1: Rename ARN "American Express Lounge" → "The Centurion Lounge" ===');
  const arnRow = db.prepare(`SELECT id FROM airports WHERE iata_code = 'ARN'`).get() as { id: number } | undefined;
  if (arnRow) {
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(arnRow.id, ARN_RENAME.from) as { id: number } | undefined;
    const alreadyRenamed = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(arnRow.id, ARN_RENAME.to) as { id: number } | undefined;
    if (alreadyRenamed) {
      console.log(`  ↩ ARN already has "${ARN_RENAME.to}" (id=${alreadyRenamed.id}) — skipping rename`);
    } else if (existing) {
      db.prepare(`UPDATE lounges SET name = ? WHERE id = ?`).run(ARN_RENAME.to, existing.id);
      console.log(`  ✓ ARN lounge id=${existing.id}: "${ARN_RENAME.from}" → "${ARN_RENAME.to}"`);
    } else {
      console.log(`  ⚠ ARN: neither "${ARN_RENAME.from}" nor "${ARN_RENAME.to}" found — skipping`);
    }
  }

  console.log('\n=== Part 2: Seed Centurion Lounges at 7 in-DB airports ===');
  let inserted = 0, skipped = 0;
  for (const spec of CENTURION_LOUNGES) {
    if (!SEED_IATAS.has(spec.iata)) continue;

    const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(spec.iata) as { id: number } | undefined;
    if (!airportRow) { console.log(`  ⚠ ${spec.iata}: airport not in DB (should not happen — check SEED_IATAS)`); continue; }

    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportRow.id, spec.name) as { id: number } | undefined;
    if (existing) {
      console.log(`  ↩ ${spec.iata} "${spec.name}": id=${existing.id} — skip`);
      skipped++;
      continue;
    }

    const locationDescription = spec.terminal
      ? `${spec.terminal}, after security`
      : 'After security';

    const result = db.prepare(`
      INSERT INTO lounges (airport_id, terminal_id, name, location_description,
        tier, lounge_class, area, opening_hours, amenities)
      VALUES (?, NULL, ?, ?, 'premium', 'business', 'all', NULL, ?)
    `).run(airportRow.id, spec.name, locationDescription, JSON.stringify(PREMIUM_AMENITIES));

    const loungeId = Number(result.lastInsertRowid);
    console.log(`  ✓ ${spec.iata} "${spec.name}" (id=${loungeId}, ${spec.terminal ?? 'no terminal'})`);

    // Single amex_centurion channel
    const chResult = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (?, 'amex_centurion', NULL)
    `).run(loungeId);

    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to,
         priority, confidence, conditions, source_url, verified_at)
      VALUES (?, NULL, NULL, '2020-01-01', NULL, 100, 0.95, NULL, ?, ?)
    `).run(chResult.lastInsertRowid, `${SOURCE_URL} + ${spec.source}`, TODAY);

    inserted++;
  }
  console.log(`\nDone. inserted=${inserted} skipped=${skipped}`);
})();

db.close();
