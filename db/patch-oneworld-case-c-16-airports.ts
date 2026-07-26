/**
 * §66 Case C oneworld layer: seed oneworld-reciprocal lounges for the 16
 * Case C airports (airport rows + Centurion lounges added in the previous
 * PR). Data comes strictly from the fresh oneworld.com scrape captured in
 * scripts/output/oneworld-lounges.json (re-scraped 2026-07-26 with the
 * accessPolicyText extension so §51 wording drives classification).
 *
 * Classification (all §51 wording-driven, none name-based):
 *
 *   26 lounges — "Access for eligible customers traveling on any oneworld
 *     member airline." → Ryhmä 2 → all_alliance + min_tier. Carrier list on
 *     the page is informative, not authoritative → carrier_restriction=null.
 *
 *   12 lounges — "Access for eligible customers traveling on these oneworld
 *     member airlines only." → Ryhmä 1 → carrier_specific + carriers from
 *     the scrape.
 *
 * Not seeded (3 deferrals, §39-style):
 *
 *   DCA #3  American Airlines Admirals Club - Concourse D - Temporarily closed for renovations
 *   EZE #3  LATAM VIP Lounge TEMPORARILY CLOSED
 *   MTY #1  Lounge with name literally "MTY" in oneworld.com's DOM. Not a
 *           scraper bug — the h3.lounge__title element contains only the
 *           IATA code. Deferred until oneworld.com publishes a real name.
 *
 * SLC not seeded either — oneworld.com's page rendered the
 * "No lounges were found for this airport" placeholder for SLC, so the
 * scraper recorded a no_lounges_reported error. That is source-verified
 * evidence of no oneworld-reciprocal lounge at SLC (not evidence of no
 * lounges at all — SLC is a Delta hub with major Sky Club and Centurion
 * presence). Coverage stays 'unverified' per §67 semantics.
 *
 * §36 (AY-lisäys): NOT applied to any lounge. None of the 16 Case C
 * airports is in the Phase 20 Finnair-network table (checked against
 * db/seed-finnair-airports.ts). See §66 Case C entry — the check was
 * against direct Finnair routes only; codeshare data was not evaluated
 * and would require a re-check if that ever gets added.
 *
 * §52 (First+Emerald wording): SYD "Qantas International First" — scrape
 * shows tiers=['emerald'] only + ANY wording → OR-model, emerald alone
 * grants access, no cabin=first requirement. Modeled as `all_alliance +
 * oneworld_emerald`, ultra_premium tier, loungeClass=first. Same OR-model
 * pattern applied to SYD "Qantas Domestic Business" and "Qantas
 * International First" wherever tiers=['emerald'] only.
 *
 * Channel model per lounge: SINGLE alliance_status channel. Deliberately
 * NOT seeded: Priority Pass / LoungeKey / DragonPass / paid channels.
 * That would require primary-source verification against Priority Pass's
 * own network listing — not available in this batch's scope. §66 forbids
 * memory-reconstructed channel additions. Coverage stays 'unverified' so
 * the UI honestly says "we know the oneworld picture, other paths not
 * verified."
 *
 * Amenities: seeded verbatim from scrape data (raw oneworld.com token
 * list like "BusinessCenter", "WiFi"). Not editorially cleaned.
 * Opening hours: NOT seeded — scrape format is per-day array, translating
 * to display text would be reconstruction. Left null.
 *
 * Idempotent per (airport_id, lounge name) and per (lounge_id, channel_type,
 * alliance_access).
 *
 * Usage: npx tsx db/patch-oneworld-case-c-16-airports.ts
 */
import Database from 'better-sqlite3';
import path from 'path';
import * as fs from 'node:fs';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_URL_FOR = (iata: string) =>
  `https://www.oneworld.com/airport-lounge-results?location=${iata}`;

interface ScrapeLounge {
  name: string;
  location: string | null;
  subtitle: string | null;
  tiers: string[];
  carriers: string[];
  amenities: string[];
  accessPolicyText: string | null;
}

interface ScrapeAirport {
  iata: string;
  loungeCount: number;
  lounges: ScrapeLounge[];
  error?: string;
}

const CASE_C_IATAS = ['ATL','CLT','DCA','DEN','IAH','LAS','LGA','PHL','PHX','SFO','SLC','BOM','EZE','MEX','MTY','SYD'];

const ANY_WORDING  = 'Access for eligible customers traveling on any oneworld member airline.';
const ONLY_WORDING = 'Access for eligible customers traveling on these oneworld member airlines only.';

// Lounges deliberately skipped, keyed by (iata, exact lounge name from scrape).
// Reason lives in the file-header comment and in docs/data-integrity-todos.md §39.
const DEFERRED = new Set<string>([
  'DCA::American Airlines Admirals Club - Concourse D - Temporarily closed for renovations.',
  'EZE::LATAM VIP Lounge TEMPORARILY CLOSED',
  'MTY::MTY',
]);

// ── Load scrape output ──────────────────────────────────────────────────────
const scrape = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'scripts/output/oneworld-lounges.json'), 'utf-8'),
) as Record<string, ScrapeAirport>;

// ── Resolve airport ids from DB ─────────────────────────────────────────────
const airportIds: Record<string, number> = {};
for (const iata of CASE_C_IATAS) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) {
    console.error(`✗ ${iata}: airport row missing — run patch-centurion-case-c-16-airports.ts first`);
    process.exit(1);
  }
  airportIds[iata] = row.id;
}

// ── Deterministic tier + shape resolution from scrape fields ────────────────
function minTierFromScrape(tiers: string[]): 'oneworld_sapphire' | 'oneworld_emerald' {
  // scrape yields lowercased tier labels; canonical values seen: 'sapphire', 'emerald'.
  if (tiers.includes('sapphire')) return 'oneworld_sapphire';   // sapphire admits emerald too
  if (tiers.includes('emerald'))  return 'oneworld_emerald';    // §52 OR-model when only emerald listed
  // Fallback — should not happen for oneworld reciprocal lounges. Fail loudly.
  throw new Error(`Unexpected tiers: ${JSON.stringify(tiers)}`);
}

function loungeClassFromScrape(l: ScrapeLounge): { tier: 'ultra_premium' | 'premium'; loungeClass: 'first' | 'business' } {
  // Only First lounges are ultra_premium in this batch — signaled by
  // "First" in the name AND tiers=['emerald'] only (§52 OR-model).
  const isFirst = /\bfirst\b/i.test(l.name) && !l.tiers.includes('sapphire');
  return isFirst
    ? { tier: 'ultra_premium', loungeClass: 'first' }
    : { tier: 'premium',       loungeClass: 'business' };
}

function locationFromScrape(l: ScrapeLounge): string {
  // Prefer location; fallback subtitle (has terminal info); else empty.
  return l.location || l.subtitle || '';
}

// ── Insert loop ─────────────────────────────────────────────────────────────
let lI = 0, lS = 0, cI = 0, cS = 0, dSkip = 0, wSkip = 0;

db.transaction(() => {
  for (const iata of CASE_C_IATAS) {
    const rec = scrape[iata];
    if (!rec) { console.log(`  ⚠ ${iata}: not in scrape output — skip`); continue; }
    if (rec.error) { console.log(`  ⚠ ${iata}: scrape error "${rec.error}" — 0 oneworld lounges seeded (coverage stays unverified per §67)`); continue; }

    const airportId = airportIds[iata];
    console.log(`\n[${iata}] ${rec.loungeCount} lounge(s) in scrape`);

    for (const sl of rec.lounges) {
      const deferKey = `${iata}::${sl.name}`;
      if (DEFERRED.has(deferKey)) {
        console.log(`  ↩ DEFER  "${sl.name}"  (§39-style / broken-name — see file header)`);
        dSkip++;
        continue;
      }

      // Classify by §51 wording — no name-based fallback.
      let allianceAccess: 'all_alliance' | 'carrier_specific';
      let carrierRestriction: string[] | null;
      if (sl.accessPolicyText === ANY_WORDING) {
        allianceAccess = 'all_alliance';
        carrierRestriction = null;   // §51: carrier list here is informative
      } else if (sl.accessPolicyText === ONLY_WORDING) {
        allianceAccess = 'carrier_specific';
        carrierRestriction = sl.carriers.slice();   // authoritative
      } else {
        console.log(`  ⚠ SKIP   "${sl.name}" — unexpected wording: ${JSON.stringify(sl.accessPolicyText)}`);
        wSkip++;
        continue;
      }

      const minTier = minTierFromScrape(sl.tiers);
      const shape   = loungeClassFromScrape(sl);
      const loc     = locationFromScrape(sl);

      // Insert / find lounge. Key = (airport_id, name, location_description)
      // because oneworld.com legitimately lists multiple physically-distinct
      // lounges under the same name at the same airport — e.g. PHL and PHX
      // each have three "American Airlines Admirals Club" rows, one per
      // terminal. Location is the distinguishing field on those pages.
      let loungeId: number;
      const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ? AND (location_description = ? OR (location_description IS NULL AND ? IS NULL))`)
        .get(airportId, sl.name, loc, loc) as { id: number } | undefined;
      if (existing) {
        loungeId = existing.id;
        console.log(`  ↩ lounge exists: "${sl.name}" @ ${loc.slice(0, 40)} (id=${loungeId})`);
        lS++;
      } else {
        const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, ?, ?, ?, 'all', NULL, ?)`)
          .run(airportId, sl.name, loc, shape.tier, shape.loungeClass, JSON.stringify(sl.amenities));
        loungeId = Number(result.lastInsertRowid);
        console.log(`  ✓ ${allianceAccess === 'all_alliance' ? 'Ryhmä 2' : 'Ryhmä 1'} ${minTier.replace('oneworld_','')} :: "${sl.name}" (id=${loungeId})`);
        lI++;
      }

      // Insert / find channel
      const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = 'alliance_status' AND alliance_access = ?`)
        .get(loungeId, allianceAccess) as { id: number } | undefined;
      if (existingCh) { cS++; continue; }

      const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, 'alliance_status', ?)`)
        .run(loungeId, allianceAccess);
      db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, ?, ?, '2020-01-01', NULL, 100, 0.95, NULL, ?, ?)`)
        .run(chResult.lastInsertRowid, minTier, carrierRestriction ? JSON.stringify(carrierRestriction) : null, SOURCE_URL_FOR(iata), TODAY);
      cI++;
    }
  }
})();

console.log(`\n=== Done ===`);
console.log(`  lounges: inserted=${lI}  skipped-existing=${lS}  deferred=${dSkip}  unexpected-wording=${wSkip}`);
console.log(`  channels: inserted=${cI}  skipped-existing=${cS}`);

db.close();
