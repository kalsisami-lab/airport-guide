/**
 * Fix Phase 14: remove incorrectly inherited PP/LK/DP channels from OP Lounge by Aspire
 * (lounge_id=4), and add the correct op_card channel.
 *
 * Background: Phase 14 assumed that OP Lounge by Aspire accepts PP/LK/DP because other
 * Aspire-operated lounges at HEL do. Finavia's official source does not list these
 * channels for the OP-branded lounge — it is bank-branded access, not operator-generic.
 *
 * Lesson: operator brand (Aspire) ≠ access channels. OP Lounge uses OP-card access,
 * not the general Aspire/Plaza Premium PP/LK/DP network.
 *
 * Idempotent: safe to re-run.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_FINAVIA = 'https://www.finavia.fi/fi/lentokentat/helsinki-vantaa';

db.transaction(() => {
  // 1. Remove PP, LK, DP rules (channel ids 4, 5, 6)
  const rulesDeleted = db.prepare(`
    DELETE FROM lounge_access_rules WHERE channel_id IN (4, 5, 6)
  `).run();
  console.log(`✓ Deleted ${rulesDeleted.changes} PP/LK/DP rule(s)`);

  // 2. Remove PP, LK, DP channels
  const chsDeleted = db.prepare(`
    DELETE FROM lounge_access_channels WHERE id IN (4, 5, 6)
  `).run();
  console.log(`✓ Deleted ${chsDeleted.changes} PP/LK/DP channel(s)`);

  // 3. Add op_card channel (idempotent on lounge_id + channel_type)
  const existing = db.prepare(`
    SELECT id FROM lounge_access_channels
    WHERE lounge_id = 4 AND channel_type = 'op_card'
  `).get();

  if (!existing) {
    const ch = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (4, 'op_card', NULL)
    `).run();
    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction,
         valid_from, confidence, source_url, verified_at)
      VALUES (?, NULL, NULL, '2020-01-01', 0.9, ?, ?)
    `).run(ch.lastInsertRowid, SOURCE_FINAVIA, TODAY);
    console.log('✓ Added op_card channel');
  } else {
    console.log('  op_card channel already exists — skipping');
  }
})();

db.close();
console.log('Done.');
