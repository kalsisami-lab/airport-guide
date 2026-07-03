/**
 * Phase 21b: Restricted paid channel for HEL Finnair Lounges.
 *
 * Finnair Plus Silver (oneworld_ruby) on an AY-operated flight gets discounted
 * access to Finnair Lounge (30 € or 4800 Avios per Finnair.com). This is NOT
 * an open walk-in — unrelated third-party passengers cannot buy in.
 *
 * Modelled as: paid channel + rule (min_alliance_tier=oneworld_ruby,
 * carrier_restriction=['AY'], priority=50 so alliance_status allowed rules
 * take precedence).
 *
 * Applies to:
 *   Lounge id=2 — Finnair Lounge non-Schengen
 *   Lounge id=3 — Finnair Lounge Schengen
 *
 * NOT applied to lounge id=1 (Platinum Wing) — Finnair's official policy grants
 * Platinum Wing access to oneworld Emerald only, not paid Silver discount.
 *
 * Silver behaviour post-patch:
 *   AY Silver + AY-Economy flight → paid_available (via this new rule)
 *   AY Silver + AY-Business/First → allowed (via existing airline_own cabin rule)
 *   AY Gold/Platinum → allowed (via alliance_status all_alliance oneworld_sapphire; paid
 *     rule exists but non-paid channels return first)
 *   No status + AY flight → denied (paid rule requires oneworld_ruby tier)
 *   BA Silver + BA flight → denied (paid rule requires AY carrier)
 *
 * Idempotent: skips if a paid channel already exists on the lounge.
 * Uses raw better-sqlite3 (channel_type='paid' is in the schema enum, but the
 * project convention is raw SQL for patches).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_FINNAIR = 'https://www.finnair.com/en/smooth-travelling-at-helsinki-airport/finnair-lounges-at-helsinki-airport';

const LOUNGES = [
  { id: 2, label: 'Finnair Lounge non-Schengen' },
  { id: 3, label: 'Finnair Lounge Schengen'    },
];

db.transaction(() => {
  for (const { id, label } of LOUNGES) {
    const existing = db.prepare(`
      SELECT id FROM lounge_access_channels
      WHERE lounge_id = ? AND channel_type = 'paid'
    `).get(id) as { id: number } | undefined;

    if (existing) {
      console.log(`  ↩ ${label} (id=${id}): paid channel exists (ch=${existing.id}) — skipping`);
      continue;
    }

    const ch = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (?, 'paid', NULL)
    `).run(id);

    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction,
         valid_from, valid_to, priority, confidence, conditions,
         source_url, verified_at)
      VALUES (?, 'oneworld_ruby', '["AY"]', '2020-01-01', NULL, 50, 0.9, NULL, ?, ?)
    `).run(ch.lastInsertRowid, SOURCE_FINNAIR, TODAY);

    console.log(`  ✓ ${label} (id=${id}): added paid channel (ch=${ch.lastInsertRowid}) with rule oneworld_ruby+AY, priority=50`);
  }
})();

db.close();
console.log('Done.');
