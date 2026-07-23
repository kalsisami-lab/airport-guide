import * as fs from 'node:fs';
import Database from 'better-sqlite3';
import path from 'path';

const data = JSON.parse(fs.readFileSync('scripts/output/oneworld-lounges.json', 'utf-8'));
const db = new Database(path.join(process.cwd(), 'db/entitlements.sqlite'), { readonly: true });

const RYHMA_2_TOKENS = [
  /\bAmerican Airlines\b|\bAdmirals Club\b|\bFlagship Lounge\b/i,
  /\bBritish Airways\b|\bBA Lounge\b|^British Airways/i,
  /\bCathay Pacific\b/i,
  /\bFinnair\b/i,
  /\bIberia\b/i,
  /\bJapan Airlines\b|\bSakura Lounge\b|\bJAL\b/i,
  /\bMalaysia Airlines\b/i,
  /\bQantas\b/i,
  /\bQatar Airways\b|\bAl Safwa\b|\bAl Mourjan\b/i,
  /\bRoyal Air Maroc\b/i,
  /\bRoyal Jordanian\b/i,
  /\bSriLankan\b/i,
  /\bAlaska Lounge\b|\bAlaska Airlines Lounge\b/i,
  /\bFiji Airways\b/i,
  /\bOman Air\b/i,
];
const AMBIG = [/\bAer Lingus\b/i, /\bAir France\b/i, /\bKLM\b/i, /\bChina Eastern\b/i, /\bSAA\b|\bSouth African Airways\b/i, /\bHawaiian\b/i];
const NO_LOUNGE = new Set(['BIQ', 'BOO', 'GZP', 'KKN', 'TOS', 'TRD']);
const UK = new Set(['LHR', 'MAN', 'EDI']);

interface ScrapeLounge {
  name: string;
  carriers: string[];
  tiers: string[];
  unmappedCarrierNames: string[];
}
interface ScrapeAirport { lounges?: ScrapeLounge[] }
interface MergedLounge extends ScrapeLounge { iata: string }

const merged = new Map<string, MergedLounge>();
for (const iata of Object.keys(data as Record<string, ScrapeAirport>).sort()) {
  for (const l of (data[iata].lounges || [])) {
    const key = iata + '|' + l.name;
    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.carriers = Array.from(new Set([...existing.carriers, ...l.carriers])).sort();
    } else {
      merged.set(key, { iata, ...l });
    }
  }
}

interface DBRow {
  iata: string; lounge_name: string; channel_type: string; alliance_access: string | null;
  carrier_restriction: string | null; min_alliance_tier: string | null;
}
const dbRows = db.prepare(`
  SELECT a.iata_code AS iata, l.name AS lounge_name, c.channel_type, c.alliance_access,
         r.carrier_restriction, r.min_alliance_tier
  FROM lounges l
  JOIN lounge_access_channels c ON c.lounge_id = l.id
  JOIN lounge_access_rules r ON r.channel_id = c.id
  JOIN airports a ON a.id = l.airport_id
  WHERE c.channel_type IN ('alliance_status', 'airline_own')
`).all() as DBRow[];

const dbMap = new Map<string, { model: string; carriers: string[] | null }>();
for (const r of dbRows) {
  const key = r.iata + '|' + r.lounge_name;
  const carriers: string[] | null = r.carrier_restriction ? JSON.parse(r.carrier_restriction) : null;
  let model = 'other';
  if (r.channel_type === 'alliance_status') {
    model = r.alliance_access === 'all_alliance' ? 'R2' : r.alliance_access === 'carrier_specific' ? 'R1' : 'other';
  } else if (r.channel_type === 'airline_own') model = 'airline_own';
  if (!dbMap.has(key)) dbMap.set(key, { model, carriers });
}

interface Finding { iata: string; name: string; carriers: string[]; tiers: string[]; nameIsBrand: boolean; dbCarriers?: string[] | null }
const r2ShortList: Finding[] = [];
const r1LongList: Finding[] = [];
const r2NonBrand: Finding[] = [];

for (const m of merged.values()) {
  if (UK.has(m.iata) || NO_LOUNGE.has(m.iata)) continue;
  if (AMBIG.some(p => p.test(m.name))) continue;

  const dbEntry = dbMap.get(m.iata + '|' + m.name);
  if (!dbEntry || dbEntry.model === 'airline_own' || dbEntry.model === 'other') continue;

  const nameIsBrand = RYHMA_2_TOKENS.some(p => p.test(m.name));
  const carrierCount = m.carriers.length;

  if (dbEntry.model === 'R2') {
    if (carrierCount <= 2) r2ShortList.push({ iata: m.iata, name: m.name, carriers: m.carriers, tiers: m.tiers, nameIsBrand });
    if (!nameIsBrand) r2NonBrand.push({ iata: m.iata, name: m.name, carriers: m.carriers, tiers: m.tiers, nameIsBrand });
  } else if (dbEntry.model === 'R1' && carrierCount >= 7) {
    r1LongList.push({ iata: m.iata, name: m.name, carriers: m.carriers, tiers: m.tiers, nameIsBrand, dbCarriers: dbEntry.carriers });
  }
}

console.log('=== 1. Ryhmä 2 (all_alliance) with SHORT scrape list (<=2 carriers) — potential false Ryhmä 2 ===');
console.log('These MAY be brand-named lounges where the actual policy is "THESE only" not "ANY oneworld".');
console.log();
for (const c of r2ShortList) {
  console.log('  ' + c.iata + '  ' + c.name);
  console.log('     scrape carriers: [' + c.carriers.join(',') + ']  tiers: [' + c.tiers.join('/') + ']  nameIsBrand: ' + c.nameIsBrand);
}
if (r2ShortList.length === 0) console.log('  (none)');

console.log('\n=== 2. Ryhmä 1 (carrier_specific) with LONG scrape list (>=7 carriers) — potential missed Ryhmä 2 ===');
console.log('Long lists often mean "these are our partners but ANY oneworld member can enter" — potential ANY-oneworld wording.');
console.log();
for (const c of r1LongList) {
  console.log('  ' + c.iata + '  ' + c.name);
  console.log('     scrape (' + c.carriers.length + '): [' + c.carriers.join(',') + ']');
  console.log('     DB    (' + (c.dbCarriers?.length ?? '?') + '): [' + (c.dbCarriers || []).join(',') + ']');
  console.log('     tiers: [' + c.tiers.join('/') + ']');
}
if (r1LongList.length === 0) console.log('  (none)');

console.log('\n=== 3. Ryhmä 2 (all_alliance) with non-brand name (generic operator) ===');
console.log('These were classified all_alliance despite generic name — likely relied on unmappedCarrierNames=["oneworld"] or a manual call.');
console.log();
for (const c of r2NonBrand) {
  console.log('  ' + c.iata + '  ' + c.name + '  [' + c.carriers.join(',') + ']');
}
if (r2NonBrand.length === 0) console.log('  (none)');

db.close();
