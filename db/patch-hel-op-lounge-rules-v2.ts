/**
 * Fix Phase 14 v2: correct alliance_status rule for OP Lounge by Aspire (lounge_id=4).
 *
 * Phase 14 added an incorrect oneworld_sapphire / all_alliance rule based on the
 * assumption that OP Lounge follows standard oneworld access. Two new sources clarify:
 *
 * Source 1 (OP Group, opening article 1/2025):
 *   "OP Lounge serves OP Gold/Platinum cardholders and passengers of partner airlines
 *    that have no own lounge at Helsinki-Vantaa."
 * Source 2:
 *   "Access via OP Gold/Platinum cards (via LoungeKey/PP quota) and as a Lufthansa passenger."
 *
 * Access is contract-based per airline, not alliance-wide.
 * Confirmed partner: Lufthansa (LH). LX/OS/KL/AF — not yet confirmed, not added.
 *
 * Changes:
 *   DELETE: oneworld_sapphire all_alliance channel (id=50) + rule (id=50)
 *   INSERT: star_alliance channel with min_tier=star_gold, carrier_restriction=['LH']
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
  // 1. Remove the incorrect oneworld_sapphire / all_alliance channel + rule
  const rulesDel = db.prepare(`
    DELETE FROM lounge_access_rules
    WHERE channel_id IN (
      SELECT id FROM lounge_access_channels
      WHERE lounge_id = 4 AND channel_type = 'alliance_status' AND alliance_access = 'all_alliance'
    )
  `).run();
  const chsDel = db.prepare(`
    DELETE FROM lounge_access_channels
    WHERE lounge_id = 4 AND channel_type = 'alliance_status' AND alliance_access = 'all_alliance'
  `).run();
  console.log(`✓ Deleted oneworld rule(s): ${rulesDel.changes} rule(s), ${chsDel.changes} channel(s)`);

  // 2. Add Lufthansa star_gold channel (idempotent on lounge_id + channel_type + alliance_access)
  const existing = db.prepare(`
    SELECT id FROM lounge_access_channels
    WHERE lounge_id = 4 AND channel_type = 'alliance_status' AND alliance_access = 'carrier_specific'
  `).get();

  if (!existing) {
    const ch = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (4, 'alliance_status', 'carrier_specific')
    `).run();
    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction,
         valid_from, confidence, source_url, verified_at)
      VALUES (?, 'star_gold', '["LH"]', '2020-01-01', 0.85, ?, ?)
    `).run(ch.lastInsertRowid, SOURCE_FINAVIA, TODAY);
    console.log('✓ Added star_gold / LH channel (id=' + ch.lastInsertRowid + ')');
  } else {
    console.log('  star_alliance channel already exists — skipping');
  }
})();

db.close();
console.log('Done.');
