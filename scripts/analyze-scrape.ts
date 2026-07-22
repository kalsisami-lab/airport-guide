/**
 * Analyzes scripts/output/oneworld-lounges.json and prints:
 *   1. Overall counts (with lounges / no lounges / error)
 *   2. §36 candidates: lounges without AY on Finnair-network airports
 *   3. Unmapped carrier names (page listed → not in CARRIER_MAP)
 *   4. Per-airport lounge count table
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Lounge {
  name: string;
  location: string | null;
  carriers: string[];
  unmappedCarrierNames: string[];
  zone: 'schengen' | 'non_schengen' | null;
  tiers: string[];
}

interface Airport {
  iata: string;
  loungeCount: number;
  lounges: Lounge[];
  error?: string;
}

const raw = fs.readFileSync(path.join(process.cwd(), 'scripts/output/oneworld-lounges.json'), 'utf-8');
const data: Record<string, Airport> = JSON.parse(raw);

const iatas = Object.keys(data).sort();
const withLounges: string[] = [];
const noLounges: string[] = [];
const errored: Array<[string, string]> = [];

for (const iata of iatas) {
  const rec = data[iata];
  if (rec.error === 'no_lounges_reported') noLounges.push(iata);
  else if (rec.error) errored.push([iata, rec.error]);
  else if (rec.loungeCount > 0) withLounges.push(iata);
  else noLounges.push(iata);
}

console.log('═══ Scrape summary ═══');
console.log(`Total airports:    ${iatas.length}`);
console.log(`With lounges:      ${withLounges.length}`);
console.log(`No lounges:        ${noLounges.length}  (${noLounges.join(', ')})`);
console.log(`Errored:           ${errored.length}${errored.length ? '  (' + errored.map(([i, e]) => i + ':' + e.slice(0, 30)).join(', ') + ')' : ''}`);
console.log();

// §36 candidates: lounges that DON'T include AY, per airport
console.log('═══ §36 candidates (lounges WITHOUT AY) ═══');
console.log('(Human review needed: is this airport on Finnair network? If yes, add AY.)');
console.log();
let flaggedCount = 0;
for (const iata of withLounges) {
  const missingAyLounges = data[iata].lounges.filter(
    l => l.carriers.length > 0 && !l.carriers.includes('AY')
  );
  if (missingAyLounges.length > 0) {
    console.log(`${iata}:`);
    for (const l of missingAyLounges) {
      const zone = l.zone ? ` [${l.zone}]` : '';
      console.log(`  - ${l.name}${zone}  carriers=[${l.carriers.join(',')}]`);
      flaggedCount++;
    }
  }
}
console.log(`\nTotal §36-candidate lounges: ${flaggedCount}`);
console.log();

// Unmapped carrier names
console.log('═══ Unmapped carrier names (need adding to CARRIER_MAP) ═══');
const unmapped = new Map<string, string[]>(); // name → [airports]
for (const iata of withLounges) {
  for (const l of data[iata].lounges) {
    for (const name of l.unmappedCarrierNames) {
      if (!unmapped.has(name)) unmapped.set(name, []);
      const list = unmapped.get(name)!;
      if (!list.includes(iata)) list.push(iata);
    }
  }
}
if (unmapped.size === 0) {
  console.log('(none)');
} else {
  for (const [name, airports] of Array.from(unmapped.entries()).sort()) {
    console.log(`  "${name}"  seen at: ${airports.join(', ')}`);
  }
}
console.log();

// Per-airport lounge count
console.log('═══ Per-airport lounge counts (sorted by count) ═══');
const sorted = withLounges
  .map(iata => ({ iata, count: data[iata].loungeCount }))
  .sort((a, b) => b.count - a.count);
for (const { iata, count } of sorted) {
  console.log(`  ${iata}: ${count}`);
}
console.log();
console.log(`Total lounges across ${withLounges.length} airports: ${sorted.reduce((s, x) => s + x.count, 0)}`);
