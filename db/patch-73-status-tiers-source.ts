/**
 * §73 PR-A — stamp source_url + verified_at on existing oneworld FFP
 * tier rows (AY, BA, JL, QR, MH).
 *
 * Method (per §66 no-memory-reconstruction rule):
 *   1. Each FFP's tier-matching table is captured verbatim below from a
 *      WebFetch of oneworld.com/members/{carrier} on 2026-07-27.
 *   2. Each DB tier row is compared against the source by alliance_tier
 *      mapping — NOT by tier name spelling. Different spellings for the
 *      same mapping (e.g. "JMB Diamond" vs "Diamond") are fine; a
 *      mapping mismatch is a conflict.
 *   3. Matches get stamped source_url + verified_at. Conflicts are
 *      logged and skipped (no false-but-sourced rows).
 *   4. Base tiers (alliance_tier='none': AY Basic, BA Blue, JL JMB,
 *      QR Burgundy, MH Explorer) are NOT stamped. oneworld.com's
 *      tier-matching table omits them by design — the base tier is the
 *      absence of alliance status, not a claim the source attests.
 *      Stamping them with oneworld.com as source would misrepresent
 *      what the source says. They stay source_url=NULL as a conscious
 *      empty. See §73 in docs/data-integrity-todos.md.
 *
 * AY Lumo note: initial plan proposed sourcing Lumo from finnair.com
 * (assumed absent from oneworld). WebFetch showed oneworld.com/members/finnair
 * lists "Finnair Plus Platinum Lumo → oneworld Emerald" explicitly, so
 * Lumo is sourced from oneworld like the other AY tiers. §66 win —
 * verified instead of assumed.
 *
 * Idempotent: skips rows already stamped with the same source_url.
 * Re-stamps if source_url differs (allows a later re-verify pass to
 * update timestamps).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

interface SourceMapping {
  /** FFP code as stored in frequent_flyer_programs.code */
  ffpCode: string;
  /** oneworld.com/members/{slug} */
  sourceUrl: string;
  /** Verified tier → alliance_tier mappings from the source page.
   *  Tier names are the source's spelling; DB spelling may differ but
   *  must yield the same alliance_tier. */
  elite: Array<{ sourceTierName: string; allianceTier: string }>;
  /** DB tier_name values that map to alliance_tier='none' and are known
   *  to be absent from the source's matching table (base tiers). Not
   *  stamped — see file header. */
  baseTiersInDb: string[];
}

const SOURCES: SourceMapping[] = [
  {
    ffpCode:   'ay-plus',
    sourceUrl: 'https://www.oneworld.com/members/finnair',
    elite: [
      { sourceTierName: 'Finnair Plus Silver',         allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Finnair Plus Gold',           allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Finnair Plus Platinum',       allianceTier: 'oneworld_emerald' },
      { sourceTierName: 'Finnair Plus Platinum Lumo',  allianceTier: 'oneworld_emerald' },
    ],
    baseTiersInDb: ['Basic'],
  },
  {
    ffpCode:   'ba-exec-club',
    sourceUrl: 'https://www.oneworld.com/members/british-airways',
    elite: [
      { sourceTierName: 'British Airways Club Bronze', allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'British Airways Club Silver', allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'British Airways Club Gold',   allianceTier: 'oneworld_emerald' },
    ],
    baseTiersInDb: ['Blue'],
  },
  {
    ffpCode:   'jl-mileage',
    sourceUrl: 'https://www.oneworld.com/members/japan-airlines',
    elite: [
      // Source lists JMB Crystal → Ruby (and JGC Crystal → Sapphire; JGC not in DB).
      { sourceTierName: 'JMB Crystal',                 allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'JMB Sapphire',                allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'JMB Diamond',                 allianceTier: 'oneworld_emerald' },
    ],
    baseTiersInDb: ['JMB'],
  },
  {
    ffpCode:   'qr-privilege',
    sourceUrl: 'https://www.oneworld.com/members/qatar-airways',
    elite: [
      { sourceTierName: 'Privilege Club Silver',       allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Privilege Club Gold',         allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Privilege Club Platinum',     allianceTier: 'oneworld_emerald' },
    ],
    baseTiersInDb: ['Burgundy'],
  },
  {
    ffpCode:   'mh-enrich',
    sourceUrl: 'https://www.oneworld.com/members/malaysia-airlines',
    elite: [
      { sourceTierName: 'Enrich Silver',               allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Enrich Gold',                 allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Enrich Platinum',             allianceTier: 'oneworld_emerald' },
    ],
    baseTiersInDb: ['Explorer'],
  },
];

interface DbTierRow {
  id: number;
  tier_name: string;
  alliance_tier: string;
  source_url: string | null;
  verified_at: string | null;
}

const getFfpId = db.prepare(
  `SELECT id FROM frequent_flyer_programs WHERE code = ?`,
);
const listTiers = db.prepare<[number], DbTierRow>(
  `SELECT id, tier_name, alliance_tier, source_url, verified_at
   FROM status_tiers WHERE program_id = ? ORDER BY id`,
);
const stampTier = db.prepare(
  `UPDATE status_tiers SET source_url = ?, verified_at = ? WHERE id = ?`,
);

let stamped = 0;
let alreadyStamped = 0;
let baseSkipped = 0;
let conflicts = 0;
let unexpectedNone = 0;

db.transaction(() => {
  for (const src of SOURCES) {
    console.log(`\n=== ${src.ffpCode} — ${src.sourceUrl} ===`);
    const ffp = getFfpId.get(src.ffpCode) as { id: number } | undefined;
    if (!ffp) {
      console.error(`  ⚠ FFP not found in DB: ${src.ffpCode} — skipping`);
      continue;
    }

    // Bucket the source's elite mappings by alliance_tier for lookup.
    const sourceAllianceTiersByRank = new Set(src.elite.map((e) => e.allianceTier));

    const rows = listTiers.all(ffp.id);
    for (const row of rows) {
      // Base tier: expected to be 'none' AND in the declared base list.
      if (src.baseTiersInDb.includes(row.tier_name)) {
        if (row.alliance_tier !== 'none') {
          console.error(`  ⚠ ${row.tier_name}: declared base but DB has alliance_tier=${row.alliance_tier} (expected 'none') — inconsistent`);
          conflicts += 1;
          continue;
        }
        console.log(`  · ${row.tier_name} → none: base tier, not stamped (§73: source does not attest 'none' mappings)`);
        baseSkipped += 1;
        continue;
      }

      // Elite tier: DB must match a source mapping by alliance_tier.
      if (row.alliance_tier === 'none') {
        console.error(`  ⚠ ${row.tier_name}: alliance_tier='none' but not in declared base list — unexpected, skip`);
        unexpectedNone += 1;
        continue;
      }

      if (!sourceAllianceTiersByRank.has(row.alliance_tier)) {
        console.error(`  ⚠ ${row.tier_name}: DB alliance_tier=${row.alliance_tier} not present in source table — conflict, skip`);
        conflicts += 1;
        continue;
      }

      // Match by alliance_tier. Idempotent: skip if already stamped with
      // this source, re-stamp if source_url differs.
      if (row.source_url === src.sourceUrl) {
        console.log(`  ↩ ${row.tier_name} → ${row.alliance_tier}: already stamped (verified_at=${row.verified_at}) — skip`);
        alreadyStamped += 1;
        continue;
      }

      stampTier.run(src.sourceUrl, TODAY, row.id);
      const wasEmpty = row.source_url === null;
      console.log(
        `  ✓ ${row.tier_name} → ${row.alliance_tier}: stamped source_url + verified_at=${TODAY}` +
        (wasEmpty ? '' : ` (replaces ${row.source_url})`),
      );
      stamped += 1;
    }
  }
})();

console.log(`\n=== summary ===`);
console.log(`  stamped:            ${stamped}`);
console.log(`  already stamped:    ${alreadyStamped}`);
console.log(`  base tiers skipped: ${baseSkipped}`);
console.log(`  conflicts:          ${conflicts}`);
console.log(`  unexpected 'none':  ${unexpectedNone}`);

db.close();

if (conflicts > 0 || unexpectedNone > 0) {
  console.error(`\n⚠ conflicts detected — review before treating as complete`);
  process.exit(2);
}
