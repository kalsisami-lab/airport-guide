/**
 * Diagnostic-only: for each candidate (iata, name) from audit-51.ts's proxy
 * signals, compare DB's alliance_access classification against JSON's
 * authoritative accessPolicyText wording. §51 rule:
 *   "any oneworld member airline"   -> should be all_alliance (R2)
 *   "these oneworld member airlines" -> should be carrier_specific (R1)
 * Wording wins over proxy. This script does not write to the DB.
 */
import * as fs from 'node:fs';
import Database from 'better-sqlite3';
import path from 'path';

interface JsonLounge {
  name: string;
  carriers: string[];
  accessPolicyText?: string;
}
interface JsonAirport { lounges?: JsonLounge[] }

const data = JSON.parse(
  fs.readFileSync('scripts/output/oneworld-lounges.json', 'utf-8'),
) as Record<string, JsonAirport>;
const db = new Database(path.join(process.cwd(), 'db/entitlements.sqlite'), {
  readonly: true,
});

const CANDIDATES: { cat: string; iata: string; name: string }[] = [
  // Category 1 — DB R2 with SHORT scrape list (proxy suspects false R2)
  { cat: 'K1', iata: 'ATL', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'BKK', name: 'Cathay Pacific Lounge' },
  { cat: 'K1', iata: 'BKK', name: 'Japan Airlines Sakura Lounge' },
  { cat: 'K1', iata: 'BKK', name: 'Qatar Airways Premium Lounge' },
  { cat: 'K1', iata: 'BKK', name: 'Oman Air First & Business Class Lounge' },
  { cat: 'K1', iata: 'CDG', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'CDG', name: 'Cathay Pacific Lounge' },
  { cat: 'K1', iata: 'CLT', name: 'American Airlines Admirals Club - Concourse B' },
  { cat: 'K1', iata: 'CLT', name: 'American Airlines Admirals Club - Concourse C' },
  { cat: 'K1', iata: 'CLT', name: 'American Airlines Provisions by Admirals Club' },
  { cat: 'K1', iata: 'DCA', name: 'American Airlines Admirals Club - Concourse C' },
  { cat: 'K1', iata: 'DCA', name: 'American Airlines Admirals Club - Concourse E' },
  { cat: 'K1', iata: 'DEN', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'DFW', name: 'American Airlines Admirals Club - Terminal A' },
  { cat: 'K1', iata: 'DFW', name: 'American Airlines Admirals Club - Terminal B' },
  { cat: 'K1', iata: 'DFW', name: 'American Airlines Admirals Club - Terminal C' },
  { cat: 'K1', iata: 'DFW', name: 'American Airlines Admirals Club - Terminal E' },
  { cat: 'K1', iata: 'DOH', name: 'Qatar Airways Silver Lounge - South' },
  { cat: 'K1', iata: 'FCO', name: 'British Airways Lounge' },
  { cat: 'K1', iata: 'GVA', name: 'British Airways Lounge' },
  { cat: 'K1', iata: 'HKG', name: 'Cathay Pacific The Bridge' },
  { cat: 'K1', iata: 'HKG', name: 'Cathay Pacific The Deck' },
  { cat: 'K1', iata: 'HKG', name: 'Cathay Pacific The Pier, Business' },
  { cat: 'K1', iata: 'HKG', name: 'Cathay Pacific The Pier, First' },
  { cat: 'K1', iata: 'HKG', name: 'Cathay Pacific The Wing, First' },
  { cat: 'K1', iata: 'HKG', name: 'Qantas Hong Kong International Lounge' },
  { cat: 'K1', iata: 'HND', name: 'Cathay Pacific Lounge' },
  { cat: 'K1', iata: 'HND', name: 'Japan Airlines Sakura Lounge (Domestic)' },
  { cat: 'K1', iata: 'IAH', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'LAX', name: 'Alaska Lounge' },
  { cat: 'K1', iata: 'LAX', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'LAX', name: 'American Airlines Flagship Lounge' },
  { cat: 'K1', iata: 'LGA', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'LIN', name: 'British Airways Lounge (Open)' },
  { cat: 'K1', iata: 'MEL', name: 'Qantas Domestic Business' },
  { cat: 'K1', iata: 'MEL', name: 'Qantas International First' },
  { cat: 'K1', iata: 'MEL', name: 'The Qantas Club (Domestic)' },
  { cat: 'K1', iata: 'MIA', name: 'American Airlines Flagship Lounge' },
  { cat: 'K1', iata: 'NGO', name: 'Japan Airlines Sakura Lounge' },
  { cat: 'K1', iata: 'NRT', name: 'Japan Airlines Sakura Lounge (Domestic)' },
  { cat: 'K1', iata: 'PHL', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'PHX', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'PVG', name: 'Cathay Pacific Lounge' },
  { cat: 'K1', iata: 'SEA', name: 'Alaska Lounge' },
  { cat: 'K1', iata: 'SFO', name: 'Alaska Lounge' },
  { cat: 'K1', iata: 'SFO', name: 'American Airlines Admirals Club' },
  { cat: 'K1', iata: 'SFO', name: 'British Airways Lounge' },
  { cat: 'K1', iata: 'SFO', name: 'Cathay Pacific Lounge' },
  { cat: 'K1', iata: 'SIN', name: 'British Airways Lounge' },
  { cat: 'K1', iata: 'SIN', name: 'Cathay Pacific Lounge' },
  { cat: 'K1', iata: 'SIN', name: 'Qatar Airways Premium Lounge' },
  { cat: 'K1', iata: 'SIN', name: 'The Qantas Singapore Lounge' },
  { cat: 'K1', iata: 'SYD', name: 'Qantas Domestic Business' },
  { cat: 'K1', iata: 'SYD', name: 'The Qantas Club (Domestic)' },
  { cat: 'K1', iata: 'YYZ', name: 'American Airlines Admirals Club' },
  // Category 2 — DB R1 with LONG scrape list (proxy suspects missed R2)
  { cat: 'K2', iata: 'BCN', name: 'Joan Miro Lounge' },
  { cat: 'K2', iata: 'FCO', name: 'Prima Vista (E Gates)' },
  { cat: 'K2', iata: 'LAX', name: 'The Los Angeles Business Lounge' },
  // Category 3 — DB R2 with generic name
  { cat: 'K3', iata: 'AMS', name: 'oneworld Lounge (Lounge No.40)' },
  { cat: 'K3', iata: 'ICN', name: 'oneworld Lounge' },
];

// Build JSON lookup — collect ALL policy texts under (iata, name) key.
// Same lounge name may appear under multiple carrier sections at oneworld.com
// (a lounge is listed once per carrier that admits into it). We collect the
// set of distinct wordings so mismatches within the JSON itself show up too.
const jsonMap = new Map<string, { policies: Set<string>; carriers: Set<string> }>();
for (const [iata, air] of Object.entries(data)) {
  for (const l of air.lounges ?? []) {
    const key = iata + '|' + l.name;
    if (!jsonMap.has(key)) jsonMap.set(key, { policies: new Set(), carriers: new Set() });
    const entry = jsonMap.get(key)!;
    if (l.accessPolicyText) entry.policies.add(l.accessPolicyText);
    for (const c of l.carriers ?? []) entry.carriers.add(c);
  }
}

// Build DB lookup.
interface DBRow {
  iata: string;
  lounge_name: string;
  channel_type: string;
  alliance_access: string | null;
  carrier_restriction: string | null;
}
const dbRows = db
  .prepare(
    `SELECT a.iata_code AS iata, l.name AS lounge_name, c.channel_type,
            c.alliance_access, r.carrier_restriction
       FROM lounges l
       JOIN lounge_access_channels c ON c.lounge_id = l.id
       JOIN lounge_access_rules r ON r.channel_id = c.id
       JOIN airports a ON a.id = l.airport_id
      WHERE c.channel_type IN ('alliance_status', 'airline_own')`,
  )
  .all() as DBRow[];

const dbMap = new Map<string, { model: string; carriers: string[] | null; channelType: string }>();
for (const r of dbRows) {
  const key = r.iata + '|' + r.lounge_name;
  const carriers: string[] | null = r.carrier_restriction ? JSON.parse(r.carrier_restriction) : null;
  let model = 'other';
  if (r.channel_type === 'alliance_status') {
    model =
      r.alliance_access === 'all_alliance' ? 'R2' : r.alliance_access === 'carrier_specific' ? 'R1' : 'other';
  } else if (r.channel_type === 'airline_own') model = 'airline_own';
  if (!dbMap.has(key)) dbMap.set(key, { model, carriers, channelType: r.channel_type });
}

function classifyWording(policies: Set<string>): 'R2' | 'R1' | 'MIXED' | 'MISSING' | 'UNKNOWN' {
  if (policies.size === 0) return 'MISSING';
  const anyR2 = [...policies].some((p) => /any oneworld member airline/i.test(p));
  const anyR1 = [...policies].some((p) => /these oneworld member airlines/i.test(p));
  if (anyR2 && anyR1) return 'MIXED';
  if (anyR2) return 'R2';
  if (anyR1) return 'R1';
  return 'UNKNOWN';
}

function verdict(db: string, wording: string): string {
  if (wording === 'MISSING') return 'CANNOT COMPARE (no accessPolicyText in JSON)';
  if (wording === 'UNKNOWN') return 'CANNOT COMPARE (unrecognised wording)';
  if (wording === 'MIXED') return 'JSON HAS BOTH wordings — investigate JSON scrape';
  if (db === wording) return 'AGREE (' + db + ')';
  return 'DISAGREE — DB=' + db + ', wording=' + wording + ' -> SHOULD BE ' + wording;
}

let agrees = 0;
let disagrees = 0;
let missing = 0;
let mixed = 0;
let other = 0;

for (const cat of ['K1', 'K2', 'K3'] as const) {
  const rows = CANDIDATES.filter((c) => c.cat === cat);
  console.log('\n=== ' + cat + ' — ' + rows.length + ' candidate(s) ===');
  for (const c of rows) {
    const key = c.iata + '|' + c.name;
    const dbEntry = dbMap.get(key);
    const jsonEntry = jsonMap.get(key);

    if (!dbEntry) {
      console.log('  ' + c.iata + '  ' + c.name);
      console.log('     ⚠ DB row not found (dropped since audit-51.ts run?)');
      other++;
      continue;
    }
    if (!jsonEntry) {
      console.log('  ' + c.iata + '  ' + c.name);
      console.log('     DB=' + dbEntry.model + '  ⚠ JSON entry not found');
      other++;
      continue;
    }
    const wording = classifyWording(jsonEntry.policies);
    const dbLabel = dbEntry.model;
    const v = verdict(dbLabel, wording);
    console.log('  ' + c.iata + '  ' + c.name);
    console.log('     DB=' + dbLabel + '  wording=' + wording + '  policies=' + JSON.stringify([...jsonEntry.policies]));
    console.log('     -> ' + v);

    if (wording === 'MISSING') missing++;
    else if (wording === 'MIXED') mixed++;
    else if (wording === 'UNKNOWN') other++;
    else if (wording === dbLabel) agrees++;
    else disagrees++;
  }
}

console.log('\n=== SUMMARY ===');
console.log('  Total candidates: ' + CANDIDATES.length);
console.log('  Agree (proxy false alarm):    ' + agrees);
console.log('  DISAGREE (real §51 finding):  ' + disagrees);
console.log('  Wording MISSING in JSON:      ' + missing);
console.log('  Wording MIXED in JSON:        ' + mixed);
console.log('  Other (unknown/missing DB):   ' + other);

db.close();
