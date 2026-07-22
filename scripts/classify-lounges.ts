/**
 * Classifies each lounge in scripts/output/oneworld-lounges.json into
 * one of four seeding shapes:
 *
 *   Ryhmä 1  Third-party operator lounge (Aena/Goldair/Aspire/Plaza Premium/...)
 *              → seed with `carrier_specific` + oneworld sapphire tier +
 *                §36 AY addition rule (add AY to carrier list if missing).
 *   Ryhmä 2  Airline-branded oneworld lounge (Cathay/AA/BA/JAL/Qantas/Alaska/etc.)
 *              → seed with `all_alliance oneworld` + sapphire tier,
 *                NO carrier list, NO §36. Phase 21 §17 shape (HEL Finnair Lounge).
 *   Ryhmä 3  AMBIG contract lounges (non-oneworld operators with fixed
 *              oneworld contracts: Aer Lingus, Air France/KLM, China Eastern, SAA)
 *              → seed with `carrier_specific` + the listed carriers verbatim,
 *                NO §36. The list is authoritative, not seasonal.
 *   Ryhmä 4  PP-only, no oneworld presence
 *              → the 6 "no lounges" airports from the scrape
 *                (BIQ, BOO, GZP, KKN, TOS, TRD). AGP Phase 23 shape.
 *
 * Duplicate handling: some airports (BLL, CDG) list the same lounge
 * multiple times with different single-carrier lists. Before
 * classifying, we merge duplicates by (iata, name) and union their
 * carrier lists so downstream logic sees one authoritative row per
 * physical lounge.
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

const data: Record<string, Airport> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'scripts/output/oneworld-lounges.json'), 'utf-8')
);

// Ryhmä 2 tokens — oneworld member airline names/brands. Case-insensitive.
// Match must be word-boundary or clear brand phrase.
const RYHMA_2_TOKENS: Array<{ pattern: RegExp; carrier: string; brand: string }> = [
  { pattern: /\bAmerican Airlines\b|\bAdmirals Club\b|\bFlagship Lounge\b/i, carrier: 'AA', brand: 'American Airlines' },
  { pattern: /\bBritish Airways\b|\bBA Lounge\b|^British Airways/i,          carrier: 'BA', brand: 'British Airways' },
  { pattern: /\bCathay Pacific\b/i,                                          carrier: 'CX', brand: 'Cathay Pacific' },
  { pattern: /\bFinnair\b/i,                                                 carrier: 'AY', brand: 'Finnair' },
  { pattern: /\bIberia\b/i,                                                  carrier: 'IB', brand: 'Iberia' },
  { pattern: /\bJapan Airlines\b|\bSakura Lounge\b|\bJAL\b/i,                carrier: 'JL', brand: 'Japan Airlines / JAL' },
  { pattern: /\bMalaysia Airlines\b/i,                                       carrier: 'MH', brand: 'Malaysia Airlines' },
  { pattern: /\bQantas\b/i,                                                  carrier: 'QF', brand: 'Qantas' },
  { pattern: /\bQatar Airways\b|\bAl Safwa\b|\bAl Mourjan\b/i,               carrier: 'QR', brand: 'Qatar Airways' },
  { pattern: /\bRoyal Air Maroc\b/i,                                         carrier: 'AT', brand: 'Royal Air Maroc' },
  { pattern: /\bRoyal Jordanian\b/i,                                         carrier: 'RJ', brand: 'Royal Jordanian' },
  { pattern: /\bSriLankan\b/i,                                               carrier: 'UL', brand: 'SriLankan' },
  { pattern: /\bAlaska Lounge\b|\bAlaska Airlines Lounge\b/i,                carrier: 'AS', brand: 'Alaska Airlines' },
  { pattern: /\bFiji Airways\b/i,                                            carrier: 'FJ', brand: 'Fiji Airways' },
  { pattern: /\bOman Air\b/i,                                                carrier: 'WY', brand: 'Oman Air' },
];

// AMBIG tokens — non-oneworld airline names that appear as lounge operators.
// These are contract lounges where the carrier list matters, but the
// oneworld member access rule may or may not apply cleanly.
const AMBIG_TOKENS: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /\bAer Lingus\b/i,      note: 'EI left oneworld 2007; may still contract with BA/IB' },
  { pattern: /\bAir France\b/i,      note: 'AF is SkyTeam; contract lounge serving oneworld carrier(s)' },
  { pattern: /\bKLM\b/i,             note: 'KL is SkyTeam; same shape as AF' },
  { pattern: /\bChina Eastern\b/i,   note: 'MU is SkyTeam; contract lounge' },
  { pattern: /\bSAA\b|\bSouth African Airways\b/i, note: 'SA (former Star), contract lounge' },
  { pattern: /\bHawaiian\b/i,        note: 'HA is not oneworld; secondary access note' },
];

interface Classification {
  iata: string;
  name: string;
  carriers: string[];
  zone: string | null;
  ryhma: 1 | 2 | 3 | 4;
  brand?: string;         // Ryhmä 2 only
  ambigNote?: string;     // Ryhmä 3 only
  mergedFrom?: number;    // >1 if this row is the union of multiple dupes
}

const NO_LOUNGE_AIRPORTS = ['BIQ', 'BOO', 'GZP', 'KKN', 'TOS', 'TRD'];

// ─── Step 1: dedupe by (iata, name), unioning carrier lists ─────────────────
// Preserves the first occurrence's location/zone/tiers (they don't vary
// across duplicates in practice — the dupes are pure carrier-list variants).
type MergedLounge = Lounge & { iata: string; mergedFrom: number };
const merged = new Map<string, MergedLounge>();  // key = `${iata}|${name}`
for (const iata of Object.keys(data).sort()) {
  const rec = data[iata];
  if (!rec.lounges) continue;
  for (const l of rec.lounges) {
    const key = `${iata}|${l.name}`;
    const existing = merged.get(key);
    if (existing) {
      const unionCarriers = Array.from(new Set([...existing.carriers, ...l.carriers])).sort();
      const unionUnmapped = Array.from(new Set([...existing.unmappedCarrierNames, ...l.unmappedCarrierNames]));
      merged.set(key, {
        ...existing,
        carriers: unionCarriers,
        unmappedCarrierNames: unionUnmapped,
        mergedFrom: existing.mergedFrom + 1,
      });
    } else {
      merged.set(key, { ...l, iata, mergedFrom: 1 });
    }
  }
}

// Track which pairs actually merged (mergedFrom > 1) for reporting
const mergedPairs = Array.from(merged.values()).filter(m => m.mergedFrom > 1);

// ─── Step 2: classify each merged lounge ────────────────────────────────────
const results: Classification[] = [];

// Ryhmä 4 (PP-only airports — no oneworld presence at all)
for (const iata of NO_LOUNGE_AIRPORTS) {
  if (data[iata]) {
    results.push({
      iata, name: '(no oneworld lounges — Ryhmä 4 PP-only shape)',
      carriers: [], zone: null, ryhma: 4,
    });
  }
}

for (const m of merged.values()) {
  const l: Classification = { iata: m.iata, name: m.name, carriers: m.carriers, zone: m.zone, ryhma: 1, mergedFrom: m.mergedFrom };

  // Ryhmä 3 (AMBIG contract lounges — non-oneworld operators)
  for (const { pattern, note } of AMBIG_TOKENS) {
    if (pattern.test(m.name)) {
      l.ryhma = 3;
      l.ambigNote = note;
      results.push(l);
      break;
    }
  }
  if (l.ryhma === 3) continue;

  // Ryhmä 2 (airline-branded oneworld lounge)
  for (const { pattern, brand } of RYHMA_2_TOKENS) {
    if (pattern.test(m.name)) {
      l.ryhma = 2;
      l.brand = brand;
      results.push(l);
      break;
    }
  }
  if (l.ryhma === 2) continue;

  // Default: Ryhmä 1 (third-party operator)
  results.push(l);
}

// ─── Step 3: report ──────────────────────────────────────────────────────────
const byRyhma: Record<string, Classification[]> = { '1': [], '2': [], '3': [], '4': [] };
for (const r of results) byRyhma[String(r.ryhma)].push(r);

const uniqueLoungeTotal = merged.size;
const originalLoungeTotal = Object.values(data).reduce((s, r) => s + (r.lounges?.length || 0), 0);

console.log('═══ Duplicate merge ═══');
console.log(`Original raw lounge rows:  ${originalLoungeTotal}`);
console.log(`After merging dupes:       ${uniqueLoungeTotal}  (removed ${originalLoungeTotal - uniqueLoungeTotal})`);
if (mergedPairs.length > 0) {
  console.log('\nMerged rows (union of carrier lists):');
  for (const m of mergedPairs) {
    console.log(`  ${m.iata}  ${m.name}  → [${m.carriers.join(',')}]  (${m.mergedFrom} entries merged)`);
  }
}
console.log();

console.log('═══ Ryhmä-jako (post-dedup) ═══');
console.log(`Ryhmä 1  Third-party (carrier_specific + §36 AY-lisäys):  ${byRyhma['1'].length}`);
console.log(`Ryhmä 2  Airline-branded (all_alliance oneworld):         ${byRyhma['2'].length}`);
console.log(`Ryhmä 3  AMBIG contract (carrier_specific ILMAN §36):     ${byRyhma['3'].length}`);
console.log(`Ryhmä 4  PP-only (no oneworld — AGP-malli):                ${byRyhma['4'].length}  (${NO_LOUNGE_AIRPORTS.join(', ')})`);
const total = byRyhma['1'].length + byRyhma['2'].length + byRyhma['3'].length;
console.log(`Total unique oneworld lounges: ${total}  (+ ${byRyhma['4'].length} PP-only airports)`);
console.log();

console.log('═══ Ryhmä 1 breakdown ═══');
const ry1 = byRyhma['1'];
const withAY = ry1.filter(r => r.carriers.includes('AY')).length;
const withoutAY = ry1.length - withAY;
console.log(`  Already list AY (seed as-is):       ${withAY}`);
console.log(`  §36 rule adds AY (conf 0.95):       ${withoutAY}`);
console.log();
console.log('Ryhmä 1 examples:');
for (const r of ry1.slice(0, 12)) {
  const zoneNote = r.zone ? ` [${r.zone}]` : '';
  const ayNote = r.carriers.includes('AY') ? '' : '  ⚠ §36 add AY';
  console.log(`  ${r.iata}  ${r.name}${zoneNote}  [${r.carriers.join(',')}]${ayNote}`);
}
console.log(`  ... and ${Math.max(0, ry1.length - 12)} more`);
console.log();

console.log('═══ Ryhmä 2 breakdown ═══');
const brandCounts: Record<string, number> = {};
for (const r of byRyhma['2']) brandCounts[r.brand!] = (brandCounts[r.brand!] || 0) + 1;
for (const [b, c] of Object.entries(brandCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${b.padEnd(30)} ${c}`);
}
console.log();
console.log('Ryhmä 2 examples:');
for (const r of byRyhma['2'].slice(0, 10)) {
  console.log(`  ${r.iata}  ${r.name}  (${r.brand})  [page lists: ${r.carriers.join(',') || '—'}]`);
}
console.log();

console.log('═══ Ryhmä 3 (AMBIG contract lounges) ═══');
for (const r of byRyhma['3']) {
  console.log(`  ${r.iata}  ${r.name}  [${r.carriers.join(',')}]  — ${r.ambigNote}`);
}
console.log();

console.log('═══ Ryhmä 4 (PP-only airports) ═══');
for (const r of byRyhma['4']) {
  console.log(`  ${r.iata}  ${r.name}`);
}
