/**
 * Refresh verified_at on Finnair Lounge rules — user re-verified 2026-07-24
 * against finnair.com/fi-fi (Finnish source) and the equivalent English pages.
 *
 * Confirmed unchanged:
 *   - Airline_own rules ["AY"] on Finnair Lounge (rules 40, 41):
 *     "Voit käyttää Finnair Loungea Finnairin (AY) ja Norran liikennöimillä lennoilla"
 *     — carrier_restriction and Schengen zone assignment stand.
 *   - Zone rule (verbatim): "Voit käyttää Schengen-puolen Finnair Loungea kun lentosi
 *     lähtee Schengen-alueelta, ja non-Schengen-puolen kun lentosi lähtee non-
 *     Schengen-alueelta." — id=2 area='non_schengen', id=3 area='schengen' correct.
 *   - Silver paid access (rules 59, 60): 30 EUR or 4,800 Avios, AY-flight only,
 *     purchased in advance from digital channels. Ruby-tier + [AY] carrier
 *     restriction correct.
 *
 * NOT modeled (see §65):
 *   - Price (30 EUR / 4,800 Avios) — no price column in lounge_access_rules.
 *     Schema change deferred pending decision.
 *   - "Purchased in advance from digital channels" — no way to gate on
 *     "must purchase before arrival" in engine. Not blocking; walk-in is
 *     just not modeled as a fallback.
 *
 * Also refreshes HEL fast_track id=12 (Finnair national exception —
 * Ruby + AY grants fast track, contrary to oneworld's Sapphire+ default).
 * Content confirmed unchanged; verified_at bumped.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = '2026-07-24';

// Lounge rules
const LOUNGE_RULE_IDS = [40, 41, 59, 60];
// Airport service rule
const SERVICE_RULE_ID = 12;

let bumped = 0;
for (const id of LOUNGE_RULE_IDS) {
  const result = db.prepare(`UPDATE lounge_access_rules SET verified_at = ? WHERE id = ?`).run(TODAY, id);
  if (result.changes > 0) { console.log(`  ✓ lounge_access_rules id=${id}: verified_at → ${TODAY}`); bumped++; }
  else console.log(`  ⚠ lounge_access_rules id=${id}: not found`);
}

// airport_service_rules has verified_at too
const svcResult = db.prepare(`UPDATE airport_service_rules SET verified_at = ? WHERE id = ?`).run(TODAY, SERVICE_RULE_ID);
if (svcResult.changes > 0) { console.log(`  ✓ airport_service_rules id=${SERVICE_RULE_ID}: verified_at → ${TODAY}`); bumped++; }
else console.log(`  ⚠ airport_service_rules id=${SERVICE_RULE_ID}: not found`);

console.log(`\nDone. ${bumped} rules refreshed.`);
db.close();
