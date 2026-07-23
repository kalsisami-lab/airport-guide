/**
 * Backfill tier_semantics = 'alliance_defined' for airport service rules
 * where oneworld (or another alliance) defines the tier requirement
 * authoritatively.
 *
 * Per §64:
 *   - fast_track_security, priority_boarding, priority_checkin are oneworld-
 *     policy-defined benefits at the alliance-tier level (Sapphire+ / Emerald).
 *     A rule with min_alliance_tier for these services declares "you need this
 *     tier to qualify" as the alliance's authoritative rule. A tier miss
 *     (passenger below tier, but carrier + everything else fits) → denied.
 *
 *   - priority_baggage is also a oneworld benefit but was NOT included in
 *     user's spec for the initial rollout. Kept 'local' — revisit if the
 *     same certain-negative semantics are wanted there too.
 *
 *   - All other services + all lounge rules stay 'local' — tier miss on a
 *     lounge rule doesn't deny (§56: named-program-tier abstraction gap;
 *     lounges can have many parallel access paths, and a rule requiring
 *     emerald doesn't declare "emerald is the only path here").
 *
 * Rules WITHOUT min_alliance_tier (card providers, cabin-only, walk-in paid)
 * stay 'local' because they don't have a tier requirement to gate on.
 *
 * Idempotent: skips rows already set to 'alliance_defined'.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);

const ALLIANCE_DEFINED_SERVICES = ['fast_track_security', 'priority_boarding', 'priority_checkin'];

const rows = db.prepare(`
  SELECT id, service_type, min_alliance_tier, tier_semantics
  FROM airport_service_rules
  WHERE service_type IN (${ALLIANCE_DEFINED_SERVICES.map(() => '?').join(',')})
    AND min_alliance_tier IS NOT NULL
`).all(...ALLIANCE_DEFINED_SERVICES) as Array<{ id: number; service_type: string; min_alliance_tier: string; tier_semantics: string }>;

console.log(`Found ${rows.length} alliance-defined-candidate rules`);

let updated = 0, skipped = 0;
for (const r of rows) {
  if (r.tier_semantics === 'alliance_defined') {
    console.log(`  ↩ rule ${r.id} (${r.service_type}, ${r.min_alliance_tier}) already alliance_defined — skip`);
    skipped++;
    continue;
  }
  db.prepare(`UPDATE airport_service_rules SET tier_semantics = 'alliance_defined' WHERE id = ?`).run(r.id);
  console.log(`  ✓ rule ${r.id} (${r.service_type}, ${r.min_alliance_tier}) → alliance_defined`);
  updated++;
}

console.log(`\nDone. updated=${updated} skipped=${skipped}`);
db.close();
