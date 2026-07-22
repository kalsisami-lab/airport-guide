/**
 * LHR British Airways Concorde Room — access rule fix.
 *
 * User field report (2026, LHR T5): oneworld Emerald (BA Gold Executive Club)
 * holder on a BA Business Class ticket was DENIED entry to the Concorde Room.
 * Explicit staff message: First-class ticket required.
 *
 * Previous DB model (channel_id=14, rule_id=14):
 *   channel_type       = alliance_status
 *   alliance_access    = carrier_specific
 *   carrier_restriction = ["BA","IB"]
 *   min_alliance_tier   = oneworld_emerald
 *   conditions          = NULL
 *
 * This model would (incorrectly) grant access to any oneworld Emerald pax
 * on a BA/IB ticket in ANY cabin — including Business — which contradicts
 * the user's confirmed denial.
 *
 * New model:
 *   channel_type       = airline_own
 *   alliance_access    = NULL          (airline_own doesn't consult it)
 *   carrier_restriction = ["BA","IB"]  (Concorde Room only on BA/IB flights)
 *   min_alliance_tier   = NULL         (status not required)
 *   conditions          = { op: "equals", field: "passenger.cabin", value: "first" }
 *
 * Semantics: First-cabin passenger on a BA or IB flight → allowed. Status is
 * irrelevant. This matches BA's stated Concorde Room policy:
 *   • BA First Class ticket → in
 *   • Concorde Room Cardholder → in (not modeled — rare bespoke card)
 *   • Emerald status on BA First → in (already covered by First cabin path)
 *   • Emerald on BA Business → NOT in ✱ (user's confirmed case)
 *
 * Why change channel_type from alliance_status to airline_own?
 *   evaluateLoungeAccess.ts:117-118 short-circuits any alliance_status rule
 *   with no status or no min_tier. Non-status First pax must still enter, so
 *   the status branch is the wrong home. airline_own only requires the
 *   carrier_restriction match, plus any conditions predicate (line 113) —
 *   which is where the cabin gate lands.
 *
 * TODO(§50): No separate rule for Concorde Room Cardholders (rare bespoke
 *   card, ~4-5 characters printed on the card, not on a status program).
 *   Impact: zero known users of this app hold one. Skipped.
 *
 * Idempotent: identifies the specific channel/rule by IATA + lounge name,
 * so re-running does not touch other lounges.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_BA = 'https://www.britishairways.com/en-gb/information/at-the-airport/lounges/concorde-room';
const SOURCE_FIELD_REPORT = 'user field report: oneworld Emerald + BA Business ticket denied at LHR T5, 2026';

const rows = db.prepare(`
  SELECT c.id AS channel_id, r.id AS rule_id
  FROM lounges l
  JOIN lounge_access_channels c ON c.lounge_id = l.id
  JOIN lounge_access_rules r ON r.channel_id = c.id
  JOIN airports a ON a.id = l.airport_id
  WHERE a.iata_code = 'LHR'
    AND l.name = 'British Airways Concorde Room'
    AND c.channel_type = 'alliance_status'
`).all() as Array<{ channel_id: number; rule_id: number }>;

if (rows.length === 0) {
  console.log('  ↩ No matching Concorde Room alliance_status row found (already migrated or missing) — nothing to do');
  db.close();
  process.exit(0);
}

if (rows.length > 1) {
  console.error(`  ⚠ Expected exactly 1 alliance_status row on Concorde Room, found ${rows.length} — aborting`);
  db.close();
  process.exit(1);
}

const { channel_id, rule_id } = rows[0];

const cabinCondition = JSON.stringify({
  op: 'equals',
  field: 'passenger.cabin',
  value: 'first',
});

db.transaction(() => {
  // Migrate the channel from alliance_status → airline_own; clear alliance_access
  db.prepare(`
    UPDATE lounge_access_channels
    SET channel_type = 'airline_own', alliance_access = NULL
    WHERE id = ?
  `).run(channel_id);

  // Rule: keep [BA,IB] carrier_restriction, drop min_alliance_tier, add cabin='first' condition,
  // refresh source_url + verified_at to capture the field report
  db.prepare(`
    UPDATE lounge_access_rules
    SET min_alliance_tier = NULL,
        conditions        = ?,
        source_url        = ?,
        verified_at       = ?,
        confidence        = 0.99
    WHERE id = ?
  `).run(cabinCondition, `${SOURCE_BA} + ${SOURCE_FIELD_REPORT}`, TODAY, rule_id);

  console.log(`  ✓ Migrated Concorde Room channel ${channel_id} → airline_own`);
  console.log(`  ✓ Updated rule ${rule_id}: min_tier=NULL, conditions=cabin=first, carrier=[BA,IB]`);
  console.log(`  ✓ Source: field report (oneworld Emerald + BA Business → denied, LHR T5 2026)`);
})();

db.close();
