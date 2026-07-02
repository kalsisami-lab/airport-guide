/**
 * Phase 20: Seed Finnair's 2026 destination network into airports table.
 *
 * Inserts ~123 new airport rows from Finnair's active route map so that:
 *   - arrival IATA lookups succeed for AY routes (Phase 17 zone routing works
 *     across the whole network, not just the 5 PoC airports)
 *   - future per-airport lounge patches have an airports.id to reference
 *
 * Scope: airports table only. No lounges, terminals, or rules.
 *
 * Source: sami/airports.csv (OurAirports masterdata; 85 391 rows).
 * Fields inserted: iata_code, name, city (= municipality), country_code (= iso_country).
 * Schengen is not stored — derived at query time via lib/schengen.ts.
 *
 * Idempotent: skips IATAs already in the DB. Safe to re-run.
 *
 * Usage: npx tsx db/seed-finnair-airports.ts
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH  = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const CSV_PATH = path.join(process.cwd(), 'sami', 'airports.csv');

// Finnair 2026 network — 128 destinations across 43 countries.
// Grouped by region for readability; order does not matter for inserts.
const FINNAIR_IATAS: string[] = [
  // Finland (16)
  'HEL','IVL','JOE','JYV','KAJ','KEM','KTT','KOK','KUO','KAO','MHQ','OUL','RVN','TMP','TKU','VAA',
  // Nordics (12)
  'ARN','GOT','CPH','BLL','OSL','BGO','BOO','KKN','SVG','TRD','TOS','KEF',
  // Baltics (5)
  'TLL','TAY','RIX','VNO','KUN',
  // Central Europe (15)
  'FRA','MUC','DUS','HAM','HAJ','STR','BER','ZRH','GVA','VIE','INN','SZG','BRU','LUX','AMS',
  // Western Europe (9)
  'LHR','MAN','EDI','DUB','CDG','NCE','LYS','BOD','BIQ',
  // Southern Europe (36)
  'BCN','MAD','AGP','ALC','VLC','LPA','ACE','PMI','TFN',
  'FCO','MXP','LIN','BLQ','NAP','VCE','VRN','PSA','CTA','FLR','TRN',
  'LIS','OPO','FAO','FNC',
  'ATH','HER','JMK','RHO','JTR','CFU','CHQ','MJT','SKG','KGS',
  'MLA','PFO',
  // Eastern Europe (11)
  'PRG','WAW','KRK','GDN','BUD','LJU','TIA','SOF','BOJ','DBV','SPU',
  // Asia (12)
  'BKK','HKT','SIN','HKG','ICN','NRT','HND','KIX','NGO','DEL','PVG','XIY',
  // Middle East (2)
  'DXB','TLV',
  // North America (7)
  'JFK','ORD','DFW','LAX','MIA','SEA','YYZ',
  // Australia (1)
  'MEL',
  // Turkey (2)
  'AYT','GZP',
];

// ─── CSV parser ──────────────────────────────────────────────────────────────
// OurAirports CSV: fields are unquoted numbers OR "quoted strings" where quoted
// strings may contain commas and "" escapes. This is a minimal RFC-4180-ish parser.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; continue; }
        inQ = false;
      } else {
        cur += c;
      }
    } else {
      if (c === ',')      fields.push(cur), cur = '';
      else if (c === '"') inQ = true;
      else                cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

interface AirportRow {
  name:         string;
  municipality: string;
  isoCountry:   string;
  iataCode:     string;
}

function loadAirportsCsv(): Map<string, AirportRow> {
  const raw   = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split('\n');
  const header = parseCsvLine(lines[0]);
  const idx = {
    name:         header.indexOf('name'),
    municipality: header.indexOf('municipality'),
    isoCountry:   header.indexOf('iso_country'),
    iataCode:     header.indexOf('iata_code'),
  };
  if (Object.values(idx).some((v) => v === -1)) {
    throw new Error(`CSV header missing expected columns: ${JSON.stringify(header)}`);
  }
  const byIata = new Map<string, AirportRow>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const f = parseCsvLine(line);
    const iata = f[idx.iataCode];
    if (!iata) continue;
    byIata.set(iata, {
      name:         f[idx.name],
      municipality: f[idx.municipality],
      isoCountry:   f[idx.isoCountry],
      iataCode:     iata,
    });
  }
  return byIata;
}

// ─── Seed ────────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

const byIata = loadAirportsCsv();
const existingIatas = new Set(
  (db.prepare('SELECT iata_code FROM airports').all() as Array<{ iata_code: string }>)
    .map((r) => r.iata_code),
);

const insertStmt = db.prepare(
  'INSERT INTO airports (iata_code, name, city, country_code) VALUES (?, ?, ?, ?)',
);

let inserted = 0;
let skipped  = 0;
const missing:  string[] = [];
const noCity:   string[] = [];
const inserts:  Array<{ iata: string; name: string; city: string; cc: string }> = [];

const runAll = db.transaction(() => {
  for (const iata of FINNAIR_IATAS) {
    if (existingIatas.has(iata)) { skipped++; continue; }
    const row = byIata.get(iata);
    if (!row)              { missing.push(iata); continue; }
    if (!row.municipality) { noCity.push(iata); continue; }
    insertStmt.run(iata, row.name, row.municipality, row.isoCountry);
    inserts.push({ iata, name: row.name, city: row.municipality, cc: row.isoCountry });
    inserted++;
  }
});
runAll();

// ─── Report ──────────────────────────────────────────────────────────────────
console.log('\n─── Phase 20: Finnair airports seed ───');
console.log(`  Target list:            ${FINNAIR_IATAS.length}`);
console.log(`  Already in DB (skipped): ${skipped}`);
console.log(`  Missing from CSV:        ${missing.length}${missing.length ? '  → ' + missing.join(', ') : ''}`);
console.log(`  Missing municipality:    ${noCity.length}${noCity.length ? '  → ' + noCity.join(', ') : ''}`);
console.log(`  Inserted:                ${inserted}`);

if (inserts.length > 0) {
  console.log('\n─── Inserted rows ───');
  for (const r of inserts) {
    console.log(`  ${r.iata}  ${r.cc}  ${r.name.padEnd(45)} (${r.city})`);
  }
}

const total = (db.prepare('SELECT COUNT(*) AS c FROM airports').get() as { c: number }).c;
console.log(`\n─── DB state after seed ───`);
console.log(`  Total airports in DB: ${total}`);

db.close();
