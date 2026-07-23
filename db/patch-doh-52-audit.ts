/**
 * §52 audit — DOH corrections.
 *
 * Two independent fixes for DOH lounges that came out of the §52
 * wording audit adopted in the UK batch (Phase 33). See docs §52 and
 * new §56 (program-specific tier abstraction gap).
 *
 * ── 1. Al Safwa First Lounge — MIGRATE to airline_own + cabin=first ──
 *
 * oneworld.com data reads:
 *   - "First Class" (no separate "Emerald Tier" line)
 *   - Access exception: "QR First Class ticket OR Business Class ticket
 *     with Privilege Club Platinum"
 *   - Airlines: Qatar Airways only (no "ANY oneworld" wording)
 *
 * Previous (Batch 2c PR #10):
 *   channel_type       = alliance_status
 *   alliance_access    = all_alliance
 *   min_alliance_tier  = oneworld_emerald
 *   carrier_restriction = NULL
 *   conditions          = NULL
 * → too permissive. Grants access to any oneworld Emerald on any oneworld
 * flight, including AY Platinum on BA/CX Business etc.
 *
 * Corrected (§52 AND-model, Concorde Room style):
 *   channel_type       = airline_own
 *   alliance_access    = NULL
 *   min_alliance_tier  = NULL
 *   carrier_restriction = ["QR"]
 *   conditions          = { equals: passenger.cabin === 'first' }
 * → QR First-cabin ticket only. Consistent with LHR BA Concorde Room
 * migration (Phase #6). Named-program-tier alternative (Privilege Club
 * Platinum + Business ticket) NOT modeled — see §56.
 *
 * ── 2. Qatar Airways Platinum Lounge - South — ADD paid channel ──
 *
 * oneworld.com data reads:
 *   - "First Class" AND "Emerald Tier" as separate lines → §52 OR-model
 *   - Airlines: "ANY oneworld member airline" → §51 all_alliance
 *   - Additional: "Lounge access may be purchased by oneworld Sapphire
 *     and Ruby Tier passengers"
 *
 * Existing model (Batch 2c PR #10) — all_alliance + oneworld_emerald —
 * is CORRECT per §51 + §52. Not migrated.
 *
 * Missing: a paid channel for the "Sapphire and Ruby can purchase"
 * clause. Modeled as tier-gated paid rule (min_alliance_tier =
 * oneworld_ruby, no carrier restriction), same shape as Phase 21b
 * HEL Finnair Lounge Silver-gated paid.
 *
 * Behavior post-patch:
 *   Emerald status + any oneworld flight → allowed (existing rule, unchanged)
 *   Sapphire status + any oneworld flight → paid_available (new rule)
 *   Ruby status    + any oneworld flight → paid_available (new rule)
 *   No status                            → denied (all rules fail)
 *   Star/SkyTeam status                  → denied (all_alliance mismatch)
 *
 * Idempotent per (lounge_id, channel_type + alliance_access).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_QR = 'https://www.qatarairways.com/en/premium/lounges.html';
const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results?location=DOH';

// ─── Lookup helper ────────────────────────────────────────────────────────
function loungeId(name: string): number | null {
  const row = db.prepare(`
    SELECT l.id FROM lounges l JOIN airports a ON a.id = l.airport_id
    WHERE a.iata_code = 'DOH' AND l.name = ?
  `).get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

db.transaction(() => {
  // ── 1. Al Safwa migration ───────────────────────────────────────────────
  const alSafwaId = loungeId('Al Safwa First Lounge');
  if (!alSafwaId) {
    console.error('DOH Al Safwa First Lounge not found — aborting');
    process.exit(1);
  }

  // Check if already migrated
  const existingAirlineOwn = db.prepare(`
    SELECT c.id FROM lounge_access_channels c
    WHERE c.lounge_id = ? AND c.channel_type = 'airline_own'
  `).get(alSafwaId) as { id: number } | undefined;

  if (existingAirlineOwn) {
    console.log(`  ↩ Al Safwa: airline_own channel already exists (ch=${existingAirlineOwn.id}) — skipping migration`);
  } else {
    // Delete existing alliance_status channel + its rule
    const oldChannels = db.prepare(`
      SELECT id FROM lounge_access_channels
      WHERE lounge_id = ? AND channel_type = 'alliance_status'
    `).all(alSafwaId) as { id: number }[];
    for (const ch of oldChannels) {
      db.prepare(`DELETE FROM lounge_access_rules WHERE channel_id = ?`).run(ch.id);
      db.prepare(`DELETE FROM lounge_access_channels WHERE id = ?`).run(ch.id);
    }
    console.log(`  ✗ Al Safwa: deleted ${oldChannels.length} old alliance_status channel(s)`);

    // Insert new airline_own channel + rule
    const newCh = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (?, 'airline_own', NULL)
    `).run(alSafwaId);

    const cabinCondition = JSON.stringify({ op: 'equals', field: 'passenger.cabin', value: 'first' });

    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to,
         priority, confidence, conditions, source_url, verified_at)
      VALUES (?, NULL, '["QR"]', '2020-01-01', NULL, 100, 0.99, ?, ?, ?)
    `).run(newCh.lastInsertRowid, cabinCondition, `${SOURCE_ONEWORLD} + ${SOURCE_QR}`, TODAY);

    console.log(`  ✓ Al Safwa: migrated to airline_own [QR] + cabin='first' (ch=${newCh.lastInsertRowid})`);
    console.log(`  ⓘ Named-tier alternative (QR Privilege Club Platinum + Business) not modeled — §56`);
  }

  // ── 2. Platinum South paid channel ───────────────────────────────────────
  const platinumId = loungeId('Qatar Airways Platinum Lounge - South');
  if (!platinumId) {
    console.error('DOH QR Platinum Lounge - South not found — aborting');
    process.exit(1);
  }

  const existingPaid = db.prepare(`
    SELECT id FROM lounge_access_channels
    WHERE lounge_id = ? AND channel_type = 'paid'
  `).get(platinumId) as { id: number } | undefined;

  if (existingPaid) {
    console.log(`  ↩ Platinum South: paid channel already exists (ch=${existingPaid.id}) — skipping`);
  } else {
    const ch = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (?, 'paid', NULL)
    `).run(platinumId);

    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to,
         priority, confidence, conditions, source_url, verified_at)
      VALUES (?, 'oneworld_ruby', NULL, '2020-01-01', NULL, 50, 0.9, NULL, ?, ?)
    `).run(ch.lastInsertRowid, `${SOURCE_ONEWORLD} + ${SOURCE_QR}`, TODAY);

    console.log(`  ✓ Platinum South: added paid channel (ch=${ch.lastInsertRowid}) with rule oneworld_ruby+any, priority=50`);
    console.log(`  ⓘ Behavior: Emerald→allowed (unchanged), Sapphire/Ruby→paid_available, none→denied`);
  }

  console.log(`\nDOH §52 audit patch complete.`);
})();

db.close();
