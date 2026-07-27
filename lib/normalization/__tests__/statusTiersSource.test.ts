/**
 * §73 PR-A regression test — status_tiers source stamping.
 *
 * Verifies against the real db/entitlements.sqlite that:
 *   1. Each of AY/BA/JL/QR/MH has its elite tier rows stamped with a
 *      non-null source_url + verified_at pointing at oneworld.com.
 *   2. Base tier rows (alliance_tier='none') stay source_url=NULL —
 *      §73 explicitly does not stamp them (source does not attest 'none').
 *   3. Alliance tier mapping is unchanged from the pre-§73 state — the
 *      backfill must not have flipped any mapping while adding source_url.
 *
 * Requires patch-73-status-tiers-source.ts to have been run against the
 * checked-in DB.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

const DB_PATH = join(process.cwd(), 'db', 'entitlements.sqlite');

if (!existsSync(DB_PATH)) {
  console.error('✗ db/entitlements.sqlite not found — run: npm run db:migrate && npm run db:seed');
  process.exit(1);
}

interface Row {
  tier_name: string;
  alliance_tier: string;
  source_url: string | null;
  verified_at: string | null;
}

interface Expectation {
  ffpCode: string;
  sourceUrl: string;
  /** Expected alliance_tier per DB tier_name — the frozen pre-§73 mapping. */
  mapping: Record<string, string>;
  /** DB tier_name values that are base tiers (alliance_tier='none') and
   *  must remain source_url=NULL after §73. */
  baseTiers: string[];
}

const EXPECTED: Expectation[] = [
  {
    ffpCode: 'ay-plus',
    sourceUrl: 'https://www.oneworld.com/members/finnair',
    mapping: {
      'Basic':    'none',
      'Silver':   'oneworld_ruby',
      'Gold':     'oneworld_sapphire',
      'Platinum': 'oneworld_emerald',
      'Lumo':     'oneworld_emerald',
    },
    baseTiers: ['Basic'],
  },
  {
    ffpCode: 'ba-exec-club',
    sourceUrl: 'https://www.oneworld.com/members/british-airways',
    mapping: {
      'Blue':   'none',
      'Bronze': 'oneworld_ruby',
      'Silver': 'oneworld_sapphire',
      'Gold':   'oneworld_emerald',
    },
    baseTiers: ['Blue'],
  },
  {
    ffpCode: 'jl-mileage',
    sourceUrl: 'https://www.oneworld.com/members/japan-airlines',
    mapping: {
      'JMB':          'none',
      'JMB Crystal':  'oneworld_ruby',
      'JMB Sapphire': 'oneworld_sapphire',
      'JMB Diamond':  'oneworld_emerald',
    },
    baseTiers: ['JMB'],
  },
  {
    ffpCode: 'qr-privilege',
    sourceUrl: 'https://www.oneworld.com/members/qatar-airways',
    mapping: {
      'Burgundy': 'none',
      'Silver':   'oneworld_ruby',
      'Gold':     'oneworld_sapphire',
      'Platinum': 'oneworld_emerald',
    },
    baseTiers: ['Burgundy'],
  },
  {
    ffpCode: 'mh-enrich',
    sourceUrl: 'https://www.oneworld.com/members/malaysia-airlines',
    mapping: {
      'Explorer': 'none',
      'Silver':   'oneworld_ruby',
      'Gold':     'oneworld_sapphire',
      'Platinum': 'oneworld_emerald',
    },
    baseTiers: ['Explorer'],
  },
];

const db = new Database(DB_PATH, { readonly: true });

function loadTiers(ffpCode: string): Row[] {
  return db.prepare(`
    SELECT st.tier_name, st.alliance_tier, st.source_url, st.verified_at
    FROM status_tiers st
    JOIN frequent_flyer_programs ffp ON ffp.id = st.program_id
    WHERE ffp.code = ?
    ORDER BY st.id
  `).all(ffpCode) as Row[];
}

describe('§73 status_tiers source stamping', () => {
  for (const exp of EXPECTED) {
    describe(`FFP: ${exp.ffpCode}`, () => {
      test('alliance_tier mapping unchanged from pre-§73 state', () => {
        const rows = loadTiers(exp.ffpCode);
        assert.ok(rows.length > 0, `${exp.ffpCode}: no tier rows in DB`);
        const actual: Record<string, string> = {};
        for (const r of rows) actual[r.tier_name] = r.alliance_tier;
        assert.deepEqual(actual, exp.mapping, `${exp.ffpCode}: alliance_tier mapping drifted — §73 must not modify mappings`);
      });

      test('elite tiers stamped with source_url + verified_at', () => {
        const rows = loadTiers(exp.ffpCode);
        for (const r of rows) {
          if (exp.baseTiers.includes(r.tier_name)) continue;
          assert.equal(r.source_url, exp.sourceUrl, `${exp.ffpCode}/${r.tier_name}: source_url should be ${exp.sourceUrl}`);
          assert.ok(r.verified_at, `${exp.ffpCode}/${r.tier_name}: verified_at should be non-null`);
          // Loose ISO-date shape check (YYYY-MM-DD) — the patch uses toISOString().slice(0,10).
          assert.match(r.verified_at!, /^\d{4}-\d{2}-\d{2}$/, `${exp.ffpCode}/${r.tier_name}: verified_at should be YYYY-MM-DD`);
        }
      });

      test('base tiers remain source_url=NULL (§73 conscious empty)', () => {
        const rows = loadTiers(exp.ffpCode);
        for (const r of rows) {
          if (!exp.baseTiers.includes(r.tier_name)) continue;
          assert.equal(r.alliance_tier, 'none', `${exp.ffpCode}/${r.tier_name}: declared base but alliance_tier=${r.alliance_tier}`);
          assert.equal(r.source_url, null, `${exp.ffpCode}/${r.tier_name}: base tier should stay source_url=NULL per §73`);
          assert.equal(r.verified_at, null, `${exp.ffpCode}/${r.tier_name}: base tier should stay verified_at=NULL per §73`);
        }
      });
    });
  }
});
