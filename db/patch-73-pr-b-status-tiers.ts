/**
 * §73 PR-B — insert missing oneworld FFP tier mappings.
 *
 * Scope decisions recorded in docs/data-integrity-todos.md §73:
 *
 *   IN SCOPE (8 FFPs, 30 elite tiers):
 *     AA aa-advantage      (existing FFP, add 4 elite tiers)
 *     IB ib-plus           (existing FFP, add 5 elite tiers)
 *     AS as-atmos          (new FFP + 4 elite tiers)
 *     AT at-safar-flyer    (new FFP + 4 elite tiers)
 *     CX cx-asia-miles     (new FFP + 3 elite tiers)
 *     QF qf-frequent-flyer (new FFP + 4 elite tiers)
 *     RJ rj-royal-club     (new FFP + 3 elite tiers)
 *     UL ul-flysmiles      (new FFP + 3 elite tiers)
 *
 *   OUT OF SCOPE:
 *     FJ  — oneworld.com/members/fiji-airways states FJ has adopted AA
 *           AAdvantage as its loyalty programme; there is no fj-tabua FFP
 *           to seed. §66 correction: my prior assumptions (FJ = connect
 *           partner; then FJ = Tabua Club full member) were both wrong,
 *           the source resolved it.
 *     WY  — oneworld.com/members/oman-air lists only 2 tiers (Silver Ruby
 *           + Gold Sapphire), no Platinum/Emerald. omanair.com returned
 *           404, no second source available. Cannot distinguish "the data
 *           is complete" from "the source is incomplete" with one source.
 *           Deferred to §75.
 *
 *   OUT OF SCOPE program-specific exception tiers (§75):
 *     AA ConciergeKey     — invitation-only, oneworld.com omits, presumed Emerald
 *     QF Chairman's Lounge — invitation-only, oneworld.com omits, presumed Emerald
 *
 * Source verification method (per §66 no-memory-reconstruction rule):
 *   Each FFP's tier table was WebFetched from oneworld.com/members/{carrier}
 *   on 2026-07-28 before this patch was written. AA/QF/AS were originally
 *   two-source with carrier-own tier pages (aa.com, qantas.com, alaskaair.com),
 *   but all three second sources were unreachable (403 / timeout / 404).
 *   oneworld.com's data was accepted on its own for these because it was
 *   internally consistent, complete, and matched the user-recalled edge
 *   cases (AA Platinum Pro is on the list; QF Platinum One is on the list;
 *   AS's post-rebrand Atmos structure has no MVP 75K split by design).
 *
 * Base tiers: no base-tier row is created for any new FFP. oneworld.com
 * does not attest a base tier name for most (AT/CX/RJ/UL/AS use their
 * lowest elite tier as the entry level). Inventing base-tier names from
 * memory would be a §66 violation. If a passenger presents an unknown
 * card (e.g. "MVP" for AS), normalize.ts drops it, StatusContext=null,
 * no alliance benefits granted — correct behaviour.
 *
 * Existing FFPs (AA/IB) may have a legacy base-tier row from seed.ts;
 * such rows are left untouched (source_url stays NULL, consistent with
 * PR-A's handling of AY Basic / BA Blue / etc).
 *
 * Idempotent:
 *   - Skips FFP insert if code already exists (updates airline_id if drift).
 *   - Skips tier insert if (program_id, tier_name) already exists with a
 *     matching alliance_tier. Conflict on alliance_tier is logged and skipped
 *     (no writes over conflicting mappings).
 *   - Skips source_url stamp if row is already stamped with the same URL.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = '2026-07-28';

interface SourceMapping {
  /** IATA code of the carrier. */
  carrierIata: string;
  /** FFP code as stored (or to be stored) in frequent_flyer_programs.code. */
  ffpCode: string;
  /** FFP display name as stored in frequent_flyer_programs.name. */
  ffpName: string;
  /** oneworld.com/members/{slug} — the source verified on TODAY. */
  sourceUrl: string;
  /** Verified elite tier → alliance_tier mappings from the source page. */
  elite: Array<{ sourceTierName: string; allianceTier: string }>;
}

const SOURCES: SourceMapping[] = [
  {
    carrierIata: 'AA',
    ffpCode:     'aa-advantage',
    ffpName:     'AAdvantage',
    sourceUrl:   'https://www.oneworld.com/members/american-airlines',
    elite: [
      { sourceTierName: 'AAdvantage Gold',              allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'AAdvantage Platinum',          allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'AAdvantage Platinum Pro',      allianceTier: 'oneworld_emerald' },
      { sourceTierName: 'AAdvantage Executive Platinum', allianceTier: 'oneworld_emerald' },
    ],
  },
  {
    carrierIata: 'IB',
    ffpCode:     'ib-plus',
    ffpName:     'Iberia Plus',
    sourceUrl:   'https://www.oneworld.com/members/iberia',
    elite: [
      { sourceTierName: 'Iberia Club Plata',           allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Iberia Club Oro',             allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Iberia Singular',             allianceTier: 'oneworld_emerald' },
      { sourceTierName: 'Iberia Club Infinita',        allianceTier: 'oneworld_emerald' },
      { sourceTierName: 'Iberia Club Infinita Prime',  allianceTier: 'oneworld_emerald' },
    ],
  },
  {
    carrierIata: 'AS',
    ffpCode:     'as-atmos',
    ffpName:     'Atmos Rewards',
    sourceUrl:   'https://www.oneworld.com/members/alaska-airlines',
    elite: [
      { sourceTierName: 'Atmos Rewards Silver',   allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Atmos Rewards Gold',     allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Atmos Rewards Platinum', allianceTier: 'oneworld_emerald' },
      { sourceTierName: 'Atmos Rewards Titanium', allianceTier: 'oneworld_emerald' },
    ],
  },
  {
    carrierIata: 'AT',
    ffpCode:     'at-safar-flyer',
    ffpName:     'Safar Flyer',
    sourceUrl:   'https://www.oneworld.com/members/royal-air-maroc',
    elite: [
      { sourceTierName: 'Safar Flyer Silver',     allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Safar Flyer Gold',       allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Safar Flyer Ambassador', allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Safar Flyer Platinum',   allianceTier: 'oneworld_emerald' },
    ],
  },
  {
    carrierIata: 'CX',
    ffpCode:     'cx-asia-miles',
    ffpName:     'Asia Miles',
    sourceUrl:   'https://www.oneworld.com/members/cathay-pacific',
    elite: [
      { sourceTierName: 'Cathay Silver',  allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Cathay Gold',    allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Cathay Diamond', allianceTier: 'oneworld_emerald' },
    ],
  },
  {
    carrierIata: 'QF',
    ffpCode:     'qf-frequent-flyer',
    ffpName:     'Qantas Frequent Flyer',
    sourceUrl:   'https://www.oneworld.com/members/qantas',
    elite: [
      { sourceTierName: 'Qantas Frequent Flyer Silver',       allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Qantas Frequent Flyer Gold',         allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Qantas Frequent Flyer Platinum',     allianceTier: 'oneworld_emerald' },
      { sourceTierName: 'Qantas Frequent Flyer Platinum One', allianceTier: 'oneworld_emerald' },
    ],
  },
  {
    carrierIata: 'RJ',
    ffpCode:     'rj-royal-club',
    ffpName:     'Royal Club',
    sourceUrl:   'https://www.oneworld.com/members/royal-jordanian',
    elite: [
      // Source names: "Silver JAY", "Gold SPARROW", "Platinum HAWK".
      { sourceTierName: 'Silver JAY',     allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'Gold SPARROW',   allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'Platinum HAWK',  allianceTier: 'oneworld_emerald' },
    ],
  },
  {
    carrierIata: 'UL',
    ffpCode:     'ul-flysmiles',
    ffpName:     'FlySmiLes',
    sourceUrl:   'https://www.oneworld.com/members/srilankan-airlines',
    elite: [
      { sourceTierName: 'FlySmiLes Classic',  allianceTier: 'oneworld_ruby' },
      { sourceTierName: 'FlySmiLes Gold',     allianceTier: 'oneworld_sapphire' },
      { sourceTierName: 'FlySmiLes Platinum', allianceTier: 'oneworld_emerald' },
    ],
  },
];

interface AirlineRow { id: number; }
interface FfpRow { id: number; airline_id: number; }
interface TierRow { id: number; alliance_tier: string; source_url: string | null; }

const getAirlineByIata = db.prepare<[string], AirlineRow>(
  `SELECT id FROM airlines WHERE iata_code = ?`,
);
const getFfp = db.prepare<[string], FfpRow>(
  `SELECT id, airline_id FROM frequent_flyer_programs WHERE code = ?`,
);
const insertFfp = db.prepare(
  `INSERT INTO frequent_flyer_programs (airline_id, name, code) VALUES (?, ?, ?)`,
);
const getTierByName = db.prepare<[number, string], TierRow>(
  `SELECT id, alliance_tier, source_url FROM status_tiers
   WHERE program_id = ? AND tier_name = ?`,
);
const insertTier = db.prepare(
  `INSERT INTO status_tiers
     (program_id, tier_name, alliance_tier, fast_track, source_url, verified_at)
   VALUES (?, ?, ?, 0, ?, ?)`,
);
const stampTier = db.prepare(
  `UPDATE status_tiers SET source_url = ?, verified_at = ? WHERE id = ?`,
);

let ffpsCreated = 0;
let ffpsFound = 0;
let tiersInserted = 0;
let tiersAlreadyPresent = 0;
let tiersStamped = 0;
let conflicts = 0;

db.transaction(() => {
  for (const src of SOURCES) {
    console.log(`\n=== ${src.carrierIata} ${src.ffpCode} — ${src.sourceUrl} ===`);

    const airline = getAirlineByIata.get(src.carrierIata);
    if (!airline) {
      console.error(`  ⚠ carrier not in airlines table: ${src.carrierIata} — skip`);
      conflicts += 1;
      continue;
    }

    let ffp = getFfp.get(src.ffpCode);
    if (!ffp) {
      const result = insertFfp.run(airline.id, src.ffpName, src.ffpCode);
      const newId = Number(result.lastInsertRowid);
      ffp = { id: newId, airline_id: airline.id };
      ffpsCreated += 1;
      console.log(`  ✓ FFP inserted: ${src.ffpCode} (${src.ffpName}) → airline_id=${airline.id}, id=${newId}`);
    } else {
      ffpsFound += 1;
      if (ffp.airline_id !== airline.id) {
        console.error(`  ⚠ FFP ${src.ffpCode} airline_id=${ffp.airline_id} but airline ${src.carrierIata}.id=${airline.id} — inconsistency, skip`);
        conflicts += 1;
        continue;
      }
      console.log(`  · FFP already present: ${src.ffpCode} (id=${ffp.id})`);
    }

    for (const tier of src.elite) {
      const existing = getTierByName.get(ffp.id, tier.sourceTierName);
      if (!existing) {
        insertTier.run(ffp.id, tier.sourceTierName, tier.allianceTier, src.sourceUrl, TODAY);
        tiersInserted += 1;
        console.log(`  ✓ ${tier.sourceTierName} → ${tier.allianceTier}: inserted with source_url + verified_at=${TODAY}`);
        continue;
      }

      // Row exists — reconcile.
      if (existing.alliance_tier !== tier.allianceTier) {
        console.error(`  ⚠ ${tier.sourceTierName}: DB alliance_tier=${existing.alliance_tier} but source says ${tier.allianceTier} — conflict, skip`);
        conflicts += 1;
        continue;
      }

      if (existing.source_url === src.sourceUrl) {
        console.log(`  ↩ ${tier.sourceTierName} → ${tier.allianceTier}: already present + already stamped, skip`);
        tiersAlreadyPresent += 1;
      } else {
        stampTier.run(src.sourceUrl, TODAY, existing.id);
        tiersStamped += 1;
        const was = existing.source_url === null ? 'unsourced' : existing.source_url;
        console.log(`  ✓ ${tier.sourceTierName} → ${tier.allianceTier}: stamped (was ${was})`);
      }
    }
  }
})();

console.log(`\n=== summary ===`);
console.log(`  FFPs created:            ${ffpsCreated}`);
console.log(`  FFPs already present:    ${ffpsFound}`);
console.log(`  tiers inserted:          ${tiersInserted}`);
console.log(`  tiers already present:   ${tiersAlreadyPresent}`);
console.log(`  tiers stamped (update):  ${tiersStamped}`);
console.log(`  conflicts:               ${conflicts}`);

db.close();

if (conflicts > 0) {
  console.error(`\n⚠ conflicts detected — review before treating as complete`);
  process.exit(2);
}
