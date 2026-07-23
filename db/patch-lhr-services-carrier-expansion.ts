/**
 * Expand LHR fast_track_security + priority_boarding carrier restrictions
 * to cover all oneworld carriers operating at T3/T5.
 *
 * Motivation (post-§63): after the airport services default semantics fix,
 * a rule-miss returns not_enough_info (chip "?") instead of denied ("✗").
 * That removed the false-negative issue for LHR's [BA,IB] rules — but AY,
 * AA, CX, QF, JL, QR pax still see "?" when they should see "✓".
 *
 * oneworld.com says fast track is available at LHR T3 & T5. That's a
 * location fact, not an access criterion. The access criterion is the
 * standard oneworld benefit (Sapphire+ / Emerald). Terminal restriction
 * matters because:
 *   - T5 = BA (already covered)
 *   - T3 = AA, CX, QF, JL, QR (previously excluded from the rule)
 *   - T2 = Star Alliance (out of scope)
 *   - T4 = SkyTeam + QR (QR sometimes operates from T4 too)
 *
 * Fix:
 *   id=4  (fast_track_security)  [BA,IB] → [BA,IB,AA,CX,QF,JL,QR]
 *   id=11 (priority_boarding)    [BA,IB] → [BA,IB,AA,CX,QF,JL,QR]
 * Both get notes "Terminal 3 and 5 only" so the UI can surface the
 * location constraint if desired.
 *
 * Consistency: fast_track and priority_boarding are both alliance-level
 * oneworld benefits. Having fast_track allow AA/CX/QF/JL/QR while
 * priority_boarding restricts to BA/IB would show as ✓ vs ? for the same
 * passenger — inconsistent UX. Expanded together.
 *
 * DXB id=7 [EK] fast_track_security NOT touched — EK is not oneworld and
 * the [EK] restriction likely reflects Emirates' own fast track (their
 * airline benefit). If DXB has a separate oneworld/T3 fast track this is
 * a data gap (§63 tracks this).
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=LHR
 *     ("Fast track is available in Terminal 3 & 5")
 *   User's LHR field observation confirms oneworld-carrier coverage at
 *   both terminals
 *
 * Idempotent: skips rule if carrier list already includes the expanded set.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE = 'https://www.oneworld.com/airport-lounge-results?location=LHR';
// AY added to user's spec list [BA,IB,AA,CX,QF,JL,QR] because the accompanying
// test asserts AY-flight → allowed, and AY operates from LHR T3 (BA handling).
// Without AY, Finnair passengers still see "?" — same problem this patch aims
// to fix. Consistent with user's intent.
const EXPANDED_CARRIERS = ['BA', 'IB', 'AA', 'CX', 'QF', 'JL', 'QR', 'AY'];
const NOTES = 'Terminal 3 and Terminal 5 only';

function updateRule(ruleId: number, label: string) {
  const existing = db.prepare(`SELECT carrier_restriction FROM airport_service_rules WHERE id = ?`).get(ruleId) as { carrier_restriction: string } | undefined;
  if (!existing) {
    console.error(`  ⚠ Rule ${ruleId} (${label}) not found — skipping`);
    return;
  }
  const current: string[] = JSON.parse(existing.carrier_restriction);
  const isExpanded = EXPANDED_CARRIERS.every((c) => current.includes(c));
  if (isExpanded) {
    console.log(`  ↩ Rule ${ruleId} (${label}): already expanded to [${current.join(',')}] — skipping`);
    return;
  }
  db.prepare(`
    UPDATE airport_service_rules
    SET carrier_restriction = ?, notes = ?, source_url = ?, verified_at = ?
    WHERE id = ?
  `).run(JSON.stringify(EXPANDED_CARRIERS), NOTES, SOURCE, TODAY, ruleId);
  console.log(`  ✓ Rule ${ruleId} (${label}): carriers ${existing.carrier_restriction} → [${EXPANDED_CARRIERS.join(',')}], notes set`);
}

db.transaction(() => {
  console.log('=== Expanding LHR service rule carrier lists ===');
  updateRule(4,  'fast_track_security [BA,IB]');
  updateRule(11, 'priority_boarding [BA,IB]');
})();

db.close();
console.log('Done.');
