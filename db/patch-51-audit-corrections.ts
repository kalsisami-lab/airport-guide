/**
 * §51 audit corrections — 2 lounge reclassifications + 1 tier-mapping
 * gap closed as an audit side-effect.
 *
 * Audit method (see §70): audit-51.ts nominated 60 candidates via proxy
 * signals; audit-51-wording.ts verified them against oneworld.com's
 * `accessPolicyText`. 56/60 AGREE (proxy false alarms), 2/60 DISAGREE →
 * this patch. During test design a further gap surfaced: only 4/13
 * oneworld FFPs (AY, BA, JL, QR) have DB tier-mappings — without MH's
 * mapping the LAX fix couldn't be tested honestly. See §73 for the
 * remaining FFPs deferred to per-source verification.
 *
 * ── Part 1: MH (Malaysia Airlines) Enrich FFP + tier-mapping ─────────
 *
 * Verified 2026-07-27 against oneworld.com/members/malaysia-airlines,
 * canonical two-column tier-matching table:
 *   Enrich Platinum → oneworld Emerald
 *   Enrich Gold     → oneworld Sapphire
 *   Enrich Silver   → oneworld Ruby
 *   Enrich Explorer → (base, no alliance tier)
 *
 * Added because the LAX Business Lounge R1→R2 fix's regression test
 * needs an oneworld sapphire carrier that was NOT on the pre-fix
 * 9-carrier list (AA, BA, CX, FJ, AY, IB, JL, QF, QR). All 4 existing
 * tier-mapped FFPs (AY, BA, JL, QR) were on that list — so their
 * "sapphire→allowed" outcome doesn't distinguish pre-fix from post-fix.
 * MH is the smallest verifiable addition that gives a test where the
 * fix's actual behavior change is observable.
 *
 * ── Part 2: BKK Oman Air First & Business Class Lounge (id=205) ─────
 *
 * Wording verified 2026-07-27 via oneworld.com scrape re-run:
 *   "Access for eligible customers traveling on these oneworld member
 *    airlines only."                              → §51 Ryhmä 1
 *   Carriers listed: Finnair, Oman Air (§36 AY-inclusion — already
 *                                        present in scrape).
 *
 * Previous (Phase 32 Batch 3a, PR #5):
 *   alliance_access     = 'all_alliance'
 *   carrier_restriction = NULL
 * → too permissive. Any oneworld sapphire/emerald granted access
 *   regardless of operating carrier.
 *
 * Corrected:
 *   alliance_access     = 'carrier_specific'
 *   carrier_restriction = ["AY","WY"]
 *
 * ── Part 3: LAX The Los Angeles Business Lounge (id=214) ────────────
 *
 * Wording verified 2026-07-27:
 *   "Access for eligible customers traveling on any oneworld member
 *    airline."                                    → §51 Ryhmä 2
 *
 * Previous (Phase 32 Batch 3e, PR #13):
 *   alliance_access     = 'carrier_specific'
 *   carrier_restriction = ["AA","BA","CX","FJ","AY","IB","JL","QF","QR"]
 * → too restrictive. oneworld sapphire/emerald on MH/RJ/AT/UL/AS
 *   wrongly returned paid_available / carrier-specific denied. The
 *   long carrier list was oneworld.com's "who currently operates here"
 *   — informative, not gating — per §51 wording criterion.
 *
 * Corrected:
 *   alliance_access     = 'all_alliance'
 *   carrier_restriction = NULL
 *
 * Other channels on LAX Business Lounge (priority_pass, lounge_key,
 * dragon_pass, paid) untouched — this patch is scoped to the
 * alliance_status channel only.
 *
 * Idempotent: skips if already in target state on re-run.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD_LOUNGE = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_MH_TIERS = 'https://www.oneworld.com/members/malaysia-airlines';

function loungeId(iata: string, name: string): number | null {
  const row = db.prepare(`
    SELECT l.id FROM lounges l JOIN airports a ON a.id = l.airport_id
    WHERE a.iata_code = ? AND l.name = ?
  `).get(iata, name) as { id: number } | undefined;
  return row?.id ?? null;
}

interface AllianceRuleRow {
  rule_id: number;
  channel_id: number;
  alliance_access: string | null;
  carrier_restriction: string | null;
}

function findAllianceStatusRule(loungeId: number): AllianceRuleRow | null {
  const row = db.prepare(`
    SELECT r.id AS rule_id, c.id AS channel_id,
           c.alliance_access, r.carrier_restriction
    FROM lounge_access_rules r
    JOIN lounge_access_channels c ON c.id = r.channel_id
    WHERE c.lounge_id = ? AND c.channel_type = 'alliance_status'
  `).get(loungeId) as AllianceRuleRow | undefined;
  return row ?? null;
}

db.transaction(() => {
  // ── Part 1: MH Enrich FFP + tier-mapping ────────────────────────────
  console.log('=== Part 1: MH (Malaysia Airlines) Enrich FFP + tier-mapping ===');
  const mhAirline = db.prepare(
    `SELECT id FROM airlines WHERE iata_code = 'MH'`,
  ).get() as { id: number } | undefined;
  if (!mhAirline) {
    console.error('  ⚠ MH airline row not found — aborting');
    process.exit(1);
  }

  const existingFfp = db.prepare(
    `SELECT id FROM frequent_flyer_programs WHERE code = 'mh-enrich'`,
  ).get() as { id: number } | undefined;

  let ffpId: number;
  if (existingFfp) {
    ffpId = existingFfp.id;
    console.log(`  ↩ mh-enrich FFP already exists (id=${ffpId}) — skip insert`);
  } else {
    const res = db.prepare(
      `INSERT INTO frequent_flyer_programs (airline_id, name, code) VALUES (?, ?, ?)`,
    ).run(mhAirline.id, 'Malaysia Airlines Enrich', 'mh-enrich');
    ffpId = Number(res.lastInsertRowid);
    console.log(`  ✓ mh-enrich FFP inserted (id=${ffpId})`);
  }

  const tierRows: Array<{ tierName: string; allianceTier: string; fastTrack: number }> = [
    { tierName: 'Explorer', allianceTier: 'none',              fastTrack: 0 },
    { tierName: 'Silver',   allianceTier: 'oneworld_ruby',     fastTrack: 0 },
    { tierName: 'Gold',     allianceTier: 'oneworld_sapphire', fastTrack: 1 },
    { tierName: 'Platinum', allianceTier: 'oneworld_emerald',  fastTrack: 1 },
  ];

  for (const t of tierRows) {
    const existing = db.prepare(
      `SELECT id, alliance_tier FROM status_tiers WHERE program_id = ? AND tier_name = ?`,
    ).get(ffpId, t.tierName) as { id: number; alliance_tier: string } | undefined;
    if (existing) {
      if (existing.alliance_tier === t.allianceTier) {
        console.log(`  ↩ MH ${t.tierName}: already mapped to ${t.allianceTier} — skip`);
      } else {
        console.log(`  ⚠ MH ${t.tierName}: DB has alliance_tier=${existing.alliance_tier}, expected ${t.allianceTier} — skipping (manual review)`);
      }
      continue;
    }
    db.prepare(`
      INSERT INTO status_tiers (program_id, tier_name, alliance_tier, fast_track)
      VALUES (?, ?, ?, ?)
    `).run(ffpId, t.tierName, t.allianceTier, t.fastTrack);
    console.log(`  ✓ MH ${t.tierName} → ${t.allianceTier} (fast_track=${t.fastTrack}) inserted (source: ${SOURCE_MH_TIERS})`);
  }

  // ── Part 2: BKK Oman Air F&B Lounge — R2 → R1 + [AY, WY] ────────────
  console.log('\n=== Part 2: BKK Oman Air First & Business Class Lounge (§51: R2 → R1) ===');
  const bkkId = loungeId('BKK', 'Oman Air First & Business Class Lounge');
  if (!bkkId) {
    console.error('  ⚠ BKK Oman Air lounge not found — aborting');
    process.exit(1);
  }
  const bkkRule = findAllianceStatusRule(bkkId);
  if (!bkkRule) {
    console.error(`  ⚠ BKK Oman Air (id=${bkkId}): no alliance_status rule — aborting`);
    process.exit(1);
  }

  const bkkTargetCarriers = JSON.stringify(['AY', 'WY']);
  const bkkAlreadyCorrect =
    bkkRule.alliance_access === 'carrier_specific' &&
    bkkRule.carrier_restriction === bkkTargetCarriers;

  if (bkkAlreadyCorrect) {
    console.log(`  ↩ BKK Oman Air (id=${bkkId}): already carrier_specific ["AY","WY"] — skip`);
  } else {
    db.prepare(
      `UPDATE lounge_access_channels SET alliance_access = 'carrier_specific' WHERE id = ?`,
    ).run(bkkRule.channel_id);
    db.prepare(`
      UPDATE lounge_access_rules
      SET carrier_restriction = ?, source_url = ?, verified_at = ?
      WHERE id = ?
    `).run(bkkTargetCarriers, `${SOURCE_ONEWORLD_LOUNGE}?location=BKK`, TODAY, bkkRule.rule_id);
    console.log(`  ✓ BKK Oman Air (id=${bkkId}): all_alliance/NULL → carrier_specific/["AY","WY"] (rule id=${bkkRule.rule_id})`);
  }

  // ── Part 3: LAX Business Lounge — R1 → R2 + NULL ─────────────────────
  console.log('\n=== Part 3: LAX The Los Angeles Business Lounge (§51: R1 → R2) ===');
  const laxId = loungeId('LAX', 'The Los Angeles Business Lounge');
  if (!laxId) {
    console.error('  ⚠ LAX Business Lounge not found — aborting');
    process.exit(1);
  }
  const laxRule = findAllianceStatusRule(laxId);
  if (!laxRule) {
    console.error(`  ⚠ LAX Business Lounge (id=${laxId}): no alliance_status rule — aborting`);
    process.exit(1);
  }

  const laxAlreadyCorrect =
    laxRule.alliance_access === 'all_alliance' && laxRule.carrier_restriction === null;

  if (laxAlreadyCorrect) {
    console.log(`  ↩ LAX Business Lounge (id=${laxId}): already all_alliance/NULL — skip`);
  } else {
    db.prepare(
      `UPDATE lounge_access_channels SET alliance_access = 'all_alliance' WHERE id = ?`,
    ).run(laxRule.channel_id);
    db.prepare(`
      UPDATE lounge_access_rules
      SET carrier_restriction = NULL, source_url = ?, verified_at = ?
      WHERE id = ?
    `).run(`${SOURCE_ONEWORLD_LOUNGE}?location=LAX`, TODAY, laxRule.rule_id);
    console.log(`  ✓ LAX Business Lounge (id=${laxId}): carrier_specific/[9 carriers] → all_alliance/NULL (rule id=${laxRule.rule_id})`);
  }

  console.log('\n§51 audit corrections complete.');
})();

db.close();
