/**
 * Patch: identify lounge id=4 as "OP Lounge by Aspire" at HEL (Gate 22, Schengen Level 3).
 * Sources:
 *   Finavia: https://www.finavia.fi/fi/lentokentat/helsinki-vantaa
 *   Executive Lounges: https://www.executivelounges.com/airport-lounges/helsinki-airport-op-lounge-by-aspire
 *
 * Changes:
 *   1. Rename lounge + correct location_description
 *   2. Add source_url + verified_at + confidence 0.95 to existing PP/LK/DP rules
 *   3. Add alliance_status channel: oneworld Sapphire+ on oneworld carrier
 *   4. Add paid channel (walk-in)
 *
 * Idempotent on (lounge_id, channel_type, alliance_access).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_FINAVIA = 'https://www.finavia.fi/fi/lentokentat/helsinki-vantaa';
const SOURCE_EL      = 'https://www.executivelounges.com/airport-lounges/helsinki-airport-op-lounge-by-aspire';

// alliance_access = 'all_alliance': the engine checks passenger.operatingAlliance === 'oneworld'
// at runtime via the airlines table join — no static carrier list needed.
// Missing oneworld carriers (CX, MH, QF, RJ, AT, UL, WY) affect the airlines table,
// not this rule. See docs/data-integrity-todos.md → "Seed missing oneworld carriers".

db.transaction(() => {
  // 1. Fix lounge name and location
  const r1 = db.prepare(`
    UPDATE lounges
    SET name = 'OP Lounge by Aspire',
        location_description = 'Schengen, Level 3 — Pier B, Gate 22'
    WHERE id = 4
  `).run();
  console.log(`✓ Lounge id=4 renamed: ${r1.changes} row(s)`);

  // 2. Add source + verified date to existing PP / LK / DP rules (channel ids 4, 5, 6)
  const r2 = db.prepare(`
    UPDATE lounge_access_rules
    SET source_url = ?, verified_at = ?, confidence = 0.95
    WHERE channel_id IN (4, 5, 6)
  `).run(SOURCE_FINAVIA, TODAY);
  console.log(`✓ Existing rules updated: ${r2.changes} row(s)`);

  // 3. oneworld Sapphire+ channel (carrier must be an oneworld airline)
  const existingOW = db.prepare(`
    SELECT id FROM lounge_access_channels
    WHERE lounge_id = 4 AND channel_type = 'alliance_status' AND alliance_access = 'oneworld'
  `).get();

  if (!existingOW) {
    const ch = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (4, 'alliance_status', 'all_alliance')
    `).run();
    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction,
         valid_from, confidence, source_url, verified_at)
      VALUES (?, 'oneworld_sapphire', NULL, '2020-01-01', 0.9, ?, ?)
    `).run(ch.lastInsertRowid, SOURCE_EL, TODAY);
    console.log('✓ Added oneworld_sapphire channel');
  } else {
    console.log('  oneworld channel already exists — skipping');
  }

  // 4. Paid walk-in channel
  const existingPaid = db.prepare(`
    SELECT id FROM lounge_access_channels
    WHERE lounge_id = 4 AND channel_type = 'paid' AND alliance_access IS NULL
  `).get();

  if (!existingPaid) {
    const ch = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (4, 'paid', NULL)
    `).run();
    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction,
         valid_from, confidence, source_url, verified_at)
      VALUES (?, NULL, NULL, '2020-01-01', 0.9, ?, ?)
    `).run(ch.lastInsertRowid, SOURCE_FINAVIA, TODAY);
    console.log('✓ Added paid (walk-in) channel');
  } else {
    console.log('  paid channel already exists — skipping');
  }
})();

db.close();
console.log('Done.');
