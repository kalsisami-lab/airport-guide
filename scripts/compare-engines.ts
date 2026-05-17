/**
 * Engine comparison script — dev only.
 * Runs old and new lounge engines on a shared test corpus and reports divergences.
 *
 * Usage:  npm run compare-engines
 * Output: tmp/engine-comparison-report.json
 *         tmp/engine-comparison-report.md
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── Old engine imports ────────────────────────────────────────────────────────
import { getLoungeCandidates } from '../data/lounges/index';
import { applyHardFilter } from '../lib/loungeFilter';
import type { StaticLounge } from '../data/lounges/types';

// ─── New engine imports ────────────────────────────────────────────────────────
import { findEntitlementsAtAirport } from '../lib/entitlements/findEntitlementsAtAirport';
import { createAirlineRepository, createTierRepository } from '../lib/normalization/repository';
import { createAirportRepository } from '../lib/entitlements/repository';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CorpusCase {
  id:          string;
  description: string;
  input: {
    flight: {
      operatingCarrier:   string;
      cabin:              'first' | 'business' | 'economy';
      departureAirport:   string;
      arrivalAirport:     string;
      departureTerminalId?: number;
    };
    statusCards: { programCode: string; tierName: string }[];
    cards?:      string[];
  };
}

type LoungeVerdict = 'access' | 'denied' | 'paid_available' | 'not_enough_info' | 'likely_allowed' | 'closed' | 'not_applicable';

interface LoungeComparison {
  loungeKey:  string;  // normalized name
  oldVerdict: LoungeVerdict | 'not_in_old';
  newVerdict: LoungeVerdict | 'not_in_new';
  category:   ComparisonCategory;
}

type ComparisonCategory =
  | 'agree'
  | 'upgrade'
  | 'downgrade'
  | 'refined'
  | 'only_in_old'
  | 'only_in_new';

interface CaseResult {
  id:          string;
  description: string;
  airport:     string;
  lounges:     LoungeComparison[];
  summary: {
    agree:       number;
    upgrade:     number;
    downgrade:   number;
    refined:     number;
    only_in_old: number;
    only_in_new: number;
  };
}

interface Report {
  generatedAt: string;
  totalCases:  number;
  totals: {
    agree:       number;
    upgrade:     number;
    downgrade:   number;
    refined:     number;
    only_in_old: number;
    only_in_new: number;
  };
  cases: CaseResult[];
}

// ─── Mapping: new engine statusCards → old engine statusAccessMethods ──────────

const CARD_TO_ACCESS_METHODS: Record<string, string[]> = {
  // Finnair Plus
  'ay-plus:Platinum':    ['finnair-plus-gold', 'finnair-plus-platinum', 'oneworld-sapphire', 'oneworld-emerald'],
  'ay-plus:Lumo':        ['finnair-plus-gold', 'finnair-plus-platinum', 'oneworld-sapphire', 'oneworld-emerald'],
  'ay-plus:Gold':        ['finnair-plus-gold', 'oneworld-sapphire'],
  'ay-plus:Silver':      [],
  'ay-plus:Basic':       [],
  // British Airways Executive Club
  'ba-exec-club:Gold':   ['oneworld-sapphire', 'oneworld-emerald'],
  'ba-exec-club:Silver': ['oneworld-sapphire'],
  'ba-exec-club:Bronze': [],
  'ba-exec-club:Blue':   [],
  // Qatar Privilege Club
  'qr-privilege:Platinum': ['oneworld-sapphire', 'oneworld-emerald'],
  'qr-privilege:Gold':     ['oneworld-sapphire'],
  'qr-privilege:Silver':   [],
  'qr-privilege:Burgundy': [],
  // JAL Mileage Bank
  'jl-mileage:JMB Diamond': ['oneworld-sapphire', 'oneworld-emerald'],
  'jl-mileage:JMB Sapphire':['oneworld-sapphire'],
  'jl-mileage:JMB Crystal': [],
  'jl-mileage:JMB':         [],
  // AAdvantage
  'aa-advantage:Executive Platinum': ['oneworld-sapphire', 'oneworld-emerald'],
  'aa-advantage:Platinum Pro':       ['oneworld-sapphire'],
  'aa-advantage:Platinum':           ['oneworld-sapphire'],
  'aa-advantage:Gold':               [],
  // Lufthansa Miles & More
  'lh-miles-more:Senator':    ['star-alliance-gold'],
  'lh-miles-more:HON Circle': ['star-alliance-gold'],
  'lh-miles-more:Frequent':   [],
  'lh-miles-more:Member':     [],
  // Swiss Miles & More
  'lx-miles-more:Senator':    ['star-alliance-gold'],
  'lx-miles-more:HON Circle': ['star-alliance-gold'],
  // Turkish Miles&Smiles
  'tk-miles-smiles:Elite Plus': ['star-alliance-gold'],
  'tk-miles-smiles:Elite':      [],
  'tk-miles-smiles:Classic Plus':    [],
  // United MileagePlus
  'ua-mileageplus:1K':       ['star-alliance-gold'],
  'ua-mileageplus:Platinum': ['star-alliance-gold'],
  'ua-mileageplus:Gold':     ['star-alliance-gold'],
  'ua-mileageplus:Silver':   [],
  'ua-mileageplus:Member':   [],
  // ANA Mileage Club
  'nh-amc:Platinum':   ['star-alliance-gold'],
  'nh-amc:Braided':    ['star-alliance-gold'],
  'nh-amc:Gold':       [],
  // Air France / KLM Flying Blue
  'af-flying-blue:Ultimate':  ['skyteam-elite-plus'],
  'af-flying-blue:Platinum':  ['skyteam-elite-plus'],
  'af-flying-blue:Gold':      ['skyteam-elite-plus'],
  'af-flying-blue:Silver':    [],
  'af-flying-blue:Explorer':  [],
  'kl-flying-blue:Platinum':  ['skyteam-elite-plus'],
  'kl-flying-blue:Gold':      ['skyteam-elite-plus'],
  'kl-flying-blue:Silver':    [],
  // Delta SkyMiles
  'dl-skymiles:Diamond':  ['skyteam-elite-plus'],
  'dl-skymiles:Platinum': ['skyteam-elite-plus'],
  'dl-skymiles:Gold':     ['skyteam-elite-plus'],
  'dl-skymiles:Silver':   [],
  'dl-skymiles:Member':   [],
  // Emirates Skywards — no alliance methods
  'ek-skywards:Platinum': [],
  'ek-skywards:Gold':     [],
  'ek-skywards:Silver':   [],
  'ek-skywards:Blue':     [],
  // Iberia Plus
  'ib-plus:Platinum':  ['oneworld-sapphire', 'oneworld-emerald'],
  'ib-plus:Gold':      ['oneworld-sapphire'],
  'ib-plus:Silver':    [],
};

function getAccessMethods(statusCards: { programCode: string; tierName: string }[]): string[] {
  const methods = new Set<string>();
  for (const card of statusCards) {
    const key = `${card.programCode}:${card.tierName}`;
    const m = CARD_TO_ACCESS_METHODS[key] ?? [];
    for (const method of m) methods.add(method);
  }
  return [...methods];
}

// ─── Name normalization for cross-engine matching ──────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')   // strip (Non-Schengen), (Terminal 2), etc.
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Old engine runner ─────────────────────────────────────────────────────────

function runOldEngine(c: CorpusCase): Map<string, 'access'> {
  const accessMethods = getAccessMethods(c.input.statusCards);
  const cardNetworks  = c.input.cards ?? [];
  const carrier       = c.input.flight.operatingCarrier;
  const iata          = c.input.flight.departureAirport;

  const candidates = getLoungeCandidates({
    airportIata:          iata,
    operatingCarrierCode: carrier,
    statusAccessMethods:  accessMethods,
    cardNetworks,
  });

  const accessible = new Map<string, 'access'>();

  for (const lounge of candidates) {
    const allianceAccess = lounge.allianceAccess ?? 'all-alliance';

    const passed = applyHardFilter(
      [{ id: lounge.id, name: lounge.name, location: '', accessMethod: '',
         hours: lounge.openingHours, amenities: lounge.amenities,
         tier: lounge.tier, network: lounge.networks[0], loungeClass: lounge.loungeClass }],
      {
        operatingCarrierCode: carrier,
        statusAccessMethods:  accessMethods,
        cardNetworks,
        allowedAirlines:      lounge.allowedAirlines,
        allianceAccess,
      },
    );

    // Check each network — grant if ANY passes
    let granted = passed.length > 0;

    if (!granted && lounge.networks.length > 1) {
      for (const network of lounge.networks.slice(1)) {
        const p2 = applyHardFilter(
          [{ id: lounge.id, name: lounge.name, location: '', accessMethod: '',
             hours: lounge.openingHours, amenities: lounge.amenities,
             tier: lounge.tier, network, loungeClass: lounge.loungeClass }],
          { operatingCarrierCode: carrier, statusAccessMethods: accessMethods,
            cardNetworks, allowedAirlines: lounge.allowedAirlines, allianceAccess },
        );
        if (p2.length > 0) { granted = true; break; }
      }
    }

    if (granted) {
      accessible.set(normalizeName(lounge.name), 'access');
    }
  }

  return accessible;
}

// ─── New engine runner ─────────────────────────────────────────────────────────

const repos = {
  airlines: createAirlineRepository(),
  tiers:    createTierRepository(),
  airport:  createAirportRepository(),
};

function runNewEngine(c: CorpusCase): Map<string, LoungeVerdict> {
  const result = findEntitlementsAtAirport(
    { statusCards: c.input.statusCards, cards: (c.input.cards ?? []) as any },
    {
      operatingCarrier: c.input.flight.operatingCarrier,
      cabin:            c.input.flight.cabin,
      departureAirport: c.input.flight.departureAirport,
      arrivalAirport:   c.input.flight.arrivalAirport,
      departureTerminalId: c.input.flight.departureTerminalId,
    },
    repos,
  );

  const map = new Map<string, LoungeVerdict>();
  for (const le of result.lounges) {
    const key = normalizeName(le.lounge.name);
    const s   = le.access.status;
    const v: LoungeVerdict =
      s === 'allowed' || s === 'likely_allowed' ? 'access' :
      s === 'paid_available' ? 'paid_available' :
      s === 'not_enough_info' ? 'not_enough_info' :
      s === 'closed' ? 'closed' :
      s === 'not_applicable' ? 'not_applicable' :
      'denied';
    map.set(key, v);
  }
  return map;
}

// ─── Comparison logic ──────────────────────────────────────────────────────────

function categorize(
  old_: LoungeVerdict | 'not_in_old',
  new_: LoungeVerdict | 'not_in_new',
): ComparisonCategory {
  if (old_ === 'not_in_old') return 'only_in_new';
  if (new_ === 'not_in_new') return 'only_in_old';

  const oldAccess = old_ === 'access';
  const newAccess = new_ === 'access';

  if (oldAccess && newAccess)  return 'agree';
  if (!oldAccess && !newAccess) {
    // Both deny — but new might have richer info
    if (new_ === 'paid_available' || new_ === 'not_enough_info') return 'refined';
    return 'agree';
  }
  if (!oldAccess && newAccess) return 'upgrade';
  if (oldAccess  && !newAccess) {
    if (new_ === 'paid_available') return 'refined';
    return 'downgrade';
  }
  return 'agree';
}

function compareCase(c: CorpusCase): CaseResult {
  const oldResult = runOldEngine(c);
  const newResult = runNewEngine(c);

  const allKeys = new Set([...oldResult.keys(), ...newResult.keys()]);
  const lounges: LoungeComparison[] = [];

  for (const key of allKeys) {
    const oldVerdict: LoungeVerdict | 'not_in_old' = oldResult.get(key) ?? 'not_in_old';
    const newVerdict: LoungeVerdict | 'not_in_new' = newResult.get(key) ?? 'not_in_new';
    lounges.push({
      loungeKey:  key,
      oldVerdict,
      newVerdict,
      category:   categorize(oldVerdict, newVerdict),
    });
  }

  const summary = { agree: 0, upgrade: 0, downgrade: 0, refined: 0, only_in_old: 0, only_in_new: 0 };
  for (const l of lounges) summary[l.category]++;

  return { id: c.id, description: c.description, airport: c.input.flight.departureAirport, lounges, summary };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const corpusPath = join(process.cwd(), '__tests__', 'comparison', 'corpus.json');
  const corpus: CorpusCase[] = JSON.parse(readFileSync(corpusPath, 'utf8'));

  console.log(`Running ${corpus.length} cases…`);

  const cases: CaseResult[] = [];
  const totals = { agree: 0, upgrade: 0, downgrade: 0, refined: 0, only_in_old: 0, only_in_new: 0 };

  for (const c of corpus) {
    process.stdout.write(`  ${c.id}… `);
    const result = compareCase(c);
    cases.push(result);
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[k] += result.summary[k];
    }
    const divergent = result.lounges.filter(l => l.category !== 'agree' && l.category !== 'only_in_old' && l.category !== 'only_in_new').length;
    console.log(`${divergent > 0 ? `⚠ ${divergent} divergence(s)` : '✓'}`);
  }

  const report: Report = {
    generatedAt: new Date().toISOString(),
    totalCases:  corpus.length,
    totals,
    cases,
  };

  mkdirSync(join(process.cwd(), 'tmp'), { recursive: true });
  const jsonPath = join(process.cwd(), 'tmp', 'engine-comparison-report.json');
  const mdPath   = join(process.cwd(), 'tmp', 'engine-comparison-report.md');

  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, buildMarkdown(report));

  console.log('\n── Summary ────────────────────────────────────');
  console.log(`  Agree:       ${totals.agree}`);
  console.log(`  Upgrade:     ${totals.upgrade}   (old denied → new allowed)`);
  console.log(`  Downgrade:   ${totals.downgrade}  (old allowed → new denied)  ← needs review`);
  console.log(`  Refined:     ${totals.refined}   (both deny/allow, new adds info)`);
  console.log(`  Only old:    ${totals.only_in_old}  (lounge not in new DB)`);
  console.log(`  Only new:    ${totals.only_in_new}  (lounge not in old data)`);
  console.log(`\n  JSON → ${jsonPath}`);
  console.log(`  MD   → ${mdPath}`);
  console.log('\nDev page: http://localhost:3000/dev/engine-comparison');
}

// ─── Markdown renderer ─────────────────────────────────────────────────────────

function buildMarkdown(report: Report): string {
  const { totals } = report;
  const lines: string[] = [
    '# Engine Comparison Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Cases: ${report.totalCases}`,
    '',
    '## Summary',
    '',
    `| Category | Count |`,
    `|---|---|`,
    `| ✅ Agree | ${totals.agree} |`,
    `| ⬆ Upgrade (old denied → new allowed) | ${totals.upgrade} |`,
    `| ⬇ Downgrade (old allowed → new denied) | ${totals.downgrade} |`,
    `| 🔍 Refined (new adds detail) | ${totals.refined} |`,
    `| 👴 Only in old engine | ${totals.only_in_old} |`,
    `| 🆕 Only in new engine | ${totals.only_in_new} |`,
    '',
    '## Divergences by case',
    '',
  ];

  for (const c of report.cases) {
    const divergent = c.lounges.filter(l =>
      l.category === 'upgrade' || l.category === 'downgrade'
    );
    if (divergent.length === 0) continue;

    lines.push(`### ${c.id}: ${c.description}`);
    lines.push('');
    lines.push('| Lounge | Old verdict | New verdict | Category |');
    lines.push('|---|---|---|---|');
    for (const l of divergent) {
      const cat = l.category === 'downgrade' ? '⬇ downgrade' : '⬆ upgrade';
      lines.push(`| ${l.loungeKey} | ${l.oldVerdict} | ${l.newVerdict} | ${cat} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

main();
