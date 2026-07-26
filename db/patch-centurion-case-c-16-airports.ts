/**
 * §66 Case C: seed 16 Centurion-network airports + their Centurion Lounges
 * (17 lounges total; MEX has T1 + T2).
 *
 * Scope: airports NOT currently in the DB because Finnair does not serve them
 *        directly. Adding them extends the app's reach from a strict
 *        Finnair-passenger tool toward a general Amex Platinum holder tool
 *        for airports where Centurion presence is the operative benefit.
 *
 * §67 coverage: every new airport row gets the default `lounge_coverage_status
 *               = 'unverified'`. The UI empty-state will honestly say
 *               "we know Centurion is here, but haven't verified other
 *               lounge coverage." That is the correct signal — this patch
 *               deliberately does NOT reconstruct oneworld / SkyTeam / Star
 *               lounges for these hubs, because there is no data source for
 *               them and §66 forbids memory-reconstructed data. Extending
 *               oneworld coverage to these IATAs is a separate future PR
 *               (add to `scripts/iatas.txt`, rerun scraper, seed).
 *
 * Primary sources:
 *   - Airport metadata (iata/name/city/country_code): sami/airports.csv
 *     (OurAirports masterdata, 85 391 rows)
 *   - Lounge rows: scripts/data/centurion-lounges.json (Amex network
 *     snapshot verified 2026-07-24)
 *
 * Model per lounge (mirrors patch-centurion-lounges-in-db-airports.ts):
 *   - Single amex_centurion channel; no PP/LK/DP (Centurion is not on the
 *     Priority Pass network), no alliance channel.
 *   - tier='premium', lounge_class='business', area='all'.
 *   - Terminal info in location_description (no terminal_id — new airports
 *     have no terminals seeded either).
 *
 * Idempotent per (airport iata) and per (airport_id, lounge name).
 *
 * Usage: npx tsx db/patch-centurion-case-c-16-airports.ts
 */
import Database from 'better-sqlite3';
import path from 'path';
import * as fs from 'node:fs';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = '2026-07-24';

const CENTURION_SOURCE = 'https://www.americanexpress.com/en-us/travel/centurion-lounge';

// Airport metadata sourced verbatim from OurAirports (sami/airports.csv).
// Fields: iata, name, city (municipality), country_code.
// Left as-is from source — no "cleanup" of parentheticals per §66 rule
// against editorial reconstruction.
const AIRPORTS_TO_ADD: Array<{ iata: string; name: string; city: string; country: string }> = [
  // US (11)
  { iata: 'ATL', name: 'Hartsfield Jackson Atlanta International Airport',   city: 'Atlanta',              country: 'US' },
  { iata: 'CLT', name: 'Charlotte Douglas International Airport',            city: 'Charlotte',            country: 'US' },
  { iata: 'DCA', name: 'Ronald Reagan Washington National Airport',          city: 'Washington',           country: 'US' },
  { iata: 'DEN', name: 'Denver International Airport',                       city: 'Denver',               country: 'US' },
  { iata: 'IAH', name: 'George Bush Intercontinental Airport',               city: 'Houston',              country: 'US' },
  { iata: 'LAS', name: 'Harry Reid International Airport',                   city: 'Las Vegas',            country: 'US' },
  { iata: 'LGA', name: 'LaGuardia Airport',                                  city: 'New York',             country: 'US' },
  { iata: 'PHL', name: 'Philadelphia International Airport',                 city: 'Philadelphia',         country: 'US' },
  { iata: 'PHX', name: 'Phoenix Sky Harbor International Airport',           city: 'Phoenix',              country: 'US' },
  { iata: 'SFO', name: 'San Francisco International Airport',                city: 'San Francisco',        country: 'US' },
  { iata: 'SLC', name: 'Salt Lake City International Airport',               city: 'Salt Lake City',       country: 'US' },
  // MX (2)
  { iata: 'MEX', name: 'Mexico City Benito Juárez International Airport',    city: 'Mexico City',          country: 'MX' },
  { iata: 'MTY', name: 'Monterrey International Airport',                    city: 'Monterrey',            country: 'MX' },
  // AR (1)
  { iata: 'EZE', name: 'Ezeiza International Airport - Ministro Pistarini',  city: 'Buenos Aires (Ezeiza)', country: 'AR' },
  // IN (1)
  { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport',  city: 'Mumbai',               country: 'IN' },
  // AU (1)
  { iata: 'SYD', name: 'Sydney Kingsford Smith International Airport',       city: 'Sydney (Mascot)',       country: 'AU' },
];

const IATA_SET = new Set(AIRPORTS_TO_ADD.map((a) => a.iata));

const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts/data/centurion-lounges.json'), 'utf-8'));
const CENTURION_LOUNGES = (raw.lounges as Array<{ iata: string; name: string; terminal: string | null; source: string }>)
  .filter((l) => IATA_SET.has(l.iata));

const PREMIUM_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

let airportsInserted = 0;
let airportsSkipped  = 0;
let loungesInserted  = 0;
let loungesSkipped   = 0;

db.transaction(() => {
  console.log('=== Part 1: Insert 16 Case C airport rows ===');
  for (const a of AIRPORTS_TO_ADD) {
    const existing = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(a.iata) as { id: number } | undefined;
    if (existing) {
      console.log(`  ↩ ${a.iata} (${a.city}): airport row already exists id=${existing.id} — skipping`);
      airportsSkipped++;
      continue;
    }
    // coverage_status defaults to 'unverified' per §67.
    // coverage_source_url stays NULL — that column documents *why the
    // coverage status has its current value* (§67 semantics), and
    // "unverified" needs no justification. It is not a generic airport-
    // row provenance field. OurAirports as the metadata source is
    // recorded in the patch header / commit message instead.
    const result = db.prepare(`
      INSERT INTO airports (iata_code, name, city, country_code)
      VALUES (?, ?, ?, ?)
    `).run(a.iata, a.name, a.city, a.country);
    console.log(`  ✓ ${a.iata} (${a.city}, ${a.country}) inserted id=${result.lastInsertRowid}`);
    airportsInserted++;
  }

  console.log('\n=== Part 2: Seed Centurion Lounges at those 16 airports ===');
  for (const spec of CENTURION_LOUNGES) {
    const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(spec.iata) as { id: number } | undefined;
    if (!airportRow) {
      console.log(`  ⚠ ${spec.iata}: airport row missing (Part 1 must have failed) — skipping`);
      loungesSkipped++;
      continue;
    }

    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportRow.id, spec.name) as { id: number } | undefined;
    if (existing) {
      console.log(`  ↩ ${spec.iata} "${spec.name}": id=${existing.id} — skipping`);
      loungesSkipped++;
      continue;
    }

    const locationDescription = spec.terminal
      ? `${spec.terminal}, after security`
      : 'After security';

    const loungeResult = db.prepare(`
      INSERT INTO lounges (airport_id, terminal_id, name, location_description,
        tier, lounge_class, area, opening_hours, amenities)
      VALUES (?, NULL, ?, ?, 'premium', 'business', 'all', NULL, ?)
    `).run(airportRow.id, spec.name, locationDescription, JSON.stringify(PREMIUM_AMENITIES));

    const loungeId = Number(loungeResult.lastInsertRowid);

    const chResult = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (?, 'amex_centurion', NULL)
    `).run(loungeId);

    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to,
         priority, confidence, conditions, source_url, verified_at)
      VALUES (?, NULL, NULL, '2020-01-01', NULL, 100, 0.95, NULL, ?, ?)
    `).run(chResult.lastInsertRowid, `${CENTURION_SOURCE} + ${spec.source}`, TODAY);

    console.log(`  ✓ ${spec.iata} "${spec.name}" (id=${loungeId}, ${spec.terminal ?? 'no terminal'})`);
    loungesInserted++;
  }
})();

console.log(`\n=== Done ===`);
console.log(`  airports: inserted=${airportsInserted}  skipped=${airportsSkipped}`);
console.log(`  lounges:  inserted=${loungesInserted}   skipped=${loungesSkipped}`);

db.close();
