/**
 * §73 PR-B regression test — status_tiers source stamping for the 8
 * remaining oneworld FFPs (AA, IB, AS, AT, CX, QF, RJ, UL).
 *
 * Verifies against the real db/entitlements.sqlite that:
 *   1. Each FFP has its full elite-tier set from oneworld.com present in
 *      the DB with the right alliance_tier mapping and a source_url +
 *      verified_at that points at oneworld.com/members/{carrier}.
 *   2. Normalization of (programCode, tierName) → allianceTier flows
 *      through the repository the way the engine will consume it.
 *   3. Out-of-scope exceptions stay out: no fj-* FFP, no wy-sindbad FFP,
 *      no AA ConciergeKey / QF Chairman's Lounge tier row (all deferred
 *      to §75).
 *
 * Requires patch-73-pr-b-status-tiers.ts to have been run against the
 * checked-in DB.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { createTierRepository } from '../repository';

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
  /** Expected (tier_name → alliance_tier) — verified from
   *  oneworld.com/members/{carrier} on 2026-07-28. */
  mapping: Record<string, string>;
}

const EXPECTED: Expectation[] = [
  {
    ffpCode: 'aa-advantage',
    sourceUrl: 'https://www.oneworld.com/members/american-airlines',
    mapping: {
      'AAdvantage Gold':              'oneworld_ruby',
      'AAdvantage Platinum':          'oneworld_sapphire',
      'AAdvantage Platinum Pro':      'oneworld_emerald',
      'AAdvantage Executive Platinum': 'oneworld_emerald',
    },
  },
  {
    ffpCode: 'ib-plus',
    sourceUrl: 'https://www.oneworld.com/members/iberia',
    mapping: {
      'Iberia Club Plata':           'oneworld_ruby',
      'Iberia Club Oro':             'oneworld_sapphire',
      'Iberia Singular':             'oneworld_emerald',
      'Iberia Club Infinita':        'oneworld_emerald',
      'Iberia Club Infinita Prime':  'oneworld_emerald',
    },
  },
  {
    ffpCode: 'as-atmos',
    sourceUrl: 'https://www.oneworld.com/members/alaska-airlines',
    mapping: {
      'Atmos Rewards Silver':   'oneworld_ruby',
      'Atmos Rewards Gold':     'oneworld_sapphire',
      'Atmos Rewards Platinum': 'oneworld_emerald',
      'Atmos Rewards Titanium': 'oneworld_emerald',
    },
  },
  {
    ffpCode: 'at-safar-flyer',
    sourceUrl: 'https://www.oneworld.com/members/royal-air-maroc',
    mapping: {
      'Safar Flyer Silver':     'oneworld_ruby',
      'Safar Flyer Gold':       'oneworld_sapphire',
      'Safar Flyer Ambassador': 'oneworld_sapphire',
      'Safar Flyer Platinum':   'oneworld_emerald',
    },
  },
  {
    ffpCode: 'cx-asia-miles',
    sourceUrl: 'https://www.oneworld.com/members/cathay-pacific',
    mapping: {
      'Cathay Silver':  'oneworld_ruby',
      'Cathay Gold':    'oneworld_sapphire',
      'Cathay Diamond': 'oneworld_emerald',
    },
  },
  {
    ffpCode: 'qf-frequent-flyer',
    sourceUrl: 'https://www.oneworld.com/members/qantas',
    mapping: {
      'Qantas Frequent Flyer Silver':       'oneworld_ruby',
      'Qantas Frequent Flyer Gold':         'oneworld_sapphire',
      'Qantas Frequent Flyer Platinum':     'oneworld_emerald',
      'Qantas Frequent Flyer Platinum One': 'oneworld_emerald',
    },
  },
  {
    ffpCode: 'rj-royal-club',
    sourceUrl: 'https://www.oneworld.com/members/royal-jordanian',
    mapping: {
      'Silver JAY':    'oneworld_ruby',
      'Gold SPARROW':  'oneworld_sapphire',
      'Platinum HAWK': 'oneworld_emerald',
    },
  },
  {
    ffpCode: 'ul-flysmiles',
    sourceUrl: 'https://www.oneworld.com/members/srilankan-airlines',
    mapping: {
      'FlySmiLes Classic':  'oneworld_ruby',
      'FlySmiLes Gold':     'oneworld_sapphire',
      'FlySmiLes Platinum': 'oneworld_emerald',
    },
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

describe('§73 PR-B status_tiers source stamping (8 FFPs)', () => {
  for (const exp of EXPECTED) {
    describe(`FFP: ${exp.ffpCode}`, () => {
      test('all expected elite tiers present with correct alliance_tier', () => {
        const rows = loadTiers(exp.ffpCode);
        const actual: Record<string, string> = {};
        for (const r of rows) actual[r.tier_name] = r.alliance_tier;
        // Check every expected mapping is present (extra base-tier rows
        // from seed.ts are OK — the test only asserts elite mappings).
        for (const [tier, allianceTier] of Object.entries(exp.mapping)) {
          assert.equal(actual[tier], allianceTier, `${exp.ffpCode}/${tier}: expected ${allianceTier}, got ${actual[tier] ?? 'missing'}`);
        }
      });

      test('all elite tiers stamped with source_url + verified_at', () => {
        const rows = loadTiers(exp.ffpCode);
        for (const r of rows) {
          if (!(r.tier_name in exp.mapping)) continue;
          assert.equal(r.source_url, exp.sourceUrl, `${exp.ffpCode}/${r.tier_name}: source_url should be ${exp.sourceUrl}`);
          assert.ok(r.verified_at, `${exp.ffpCode}/${r.tier_name}: verified_at should be non-null`);
          assert.match(r.verified_at!, /^\d{4}-\d{2}-\d{2}$/, `${exp.ffpCode}/${r.tier_name}: verified_at should be YYYY-MM-DD`);
        }
      });
    });
  }

  describe('normalization: (programCode, tierName) → allianceTier', () => {
    const repo = createTierRepository();
    // One canonical elite-tier probe per FFP — matches the mappings above.
    const CASES: Array<[string, string, string]> = [
      ['aa-advantage',      'AAdvantage Executive Platinum', 'oneworld_emerald'],
      ['aa-advantage',      'AAdvantage Platinum Pro',       'oneworld_emerald'],
      ['aa-advantage',      'AAdvantage Gold',               'oneworld_ruby'],
      ['ib-plus',           'Iberia Club Infinita Prime',    'oneworld_emerald'],
      ['ib-plus',           'Iberia Singular',               'oneworld_emerald'],
      ['ib-plus',           'Iberia Club Plata',             'oneworld_ruby'],
      ['as-atmos',          'Atmos Rewards Titanium',        'oneworld_emerald'],
      ['as-atmos',          'Atmos Rewards Silver',          'oneworld_ruby'],
      ['at-safar-flyer',    'Safar Flyer Platinum',          'oneworld_emerald'],
      ['at-safar-flyer',    'Safar Flyer Ambassador',        'oneworld_sapphire'],
      ['cx-asia-miles',     'Cathay Diamond',                'oneworld_emerald'],
      ['qf-frequent-flyer', 'Qantas Frequent Flyer Platinum One', 'oneworld_emerald'],
      ['qf-frequent-flyer', 'Qantas Frequent Flyer Silver',       'oneworld_ruby'],
      ['rj-royal-club',     'Platinum HAWK',                 'oneworld_emerald'],
      ['ul-flysmiles',      'FlySmiLes Platinum',            'oneworld_emerald'],
    ];
    for (const [prog, tier, expected] of CASES) {
      test(`${prog} / ${tier} → ${expected}`, () => {
        const entry = repo.getTierForCard(prog, tier);
        assert.ok(entry, `${prog}/${tier}: repo returned null`);
        assert.equal(entry!.allianceTier, expected);
      });
    }
  });

  describe('§75 deferrals stay out', () => {
    test('no fj-* FFP exists (FJ uses AAdvantage per source)', () => {
      const rows = db.prepare(`SELECT code FROM frequent_flyer_programs WHERE code LIKE 'fj-%'`).all();
      assert.equal(rows.length, 0, 'FJ should not have an own FFP row');
    });

    test('no wy-* FFP exists (Sindbad tier count uncertain, deferred)', () => {
      const rows = db.prepare(`SELECT code FROM frequent_flyer_programs WHERE code LIKE 'wy-%'`).all();
      assert.equal(rows.length, 0, 'WY Sindbad deferred to §75 pending second source');
    });

    test('AA has no ConciergeKey tier row (invitation-only, §75)', () => {
      const rows = db.prepare(`
        SELECT tier_name FROM status_tiers st
        JOIN frequent_flyer_programs ffp ON ffp.id = st.program_id
        WHERE ffp.code = 'aa-advantage' AND tier_name LIKE '%ConciergeKey%'
      `).all();
      assert.equal(rows.length, 0, 'AA ConciergeKey deferred to §75');
    });

    test("QF has no Chairman's Lounge tier row (invitation-only, §75)", () => {
      const rows = db.prepare(`
        SELECT tier_name FROM status_tiers st
        JOIN frequent_flyer_programs ffp ON ffp.id = st.program_id
        WHERE ffp.code = 'qf-frequent-flyer' AND tier_name LIKE '%Chairman%'
      `).all();
      assert.equal(rows.length, 0, "QF Chairman's Lounge deferred to §75");
    });
  });
});
