/**
 * Phase 32 (Ryhmä 3 batch): Seed 6 AMBIG contract oneworld lounges.
 *
 * Ryhmä 3 = non-oneworld operators running contract lounges that serve
 * specific oneworld carriers. Carrier list from oneworld.com is
 * authoritative (fixed, not seasonal like Ryhmä 1's §36 — the operator's
 * contract determines who gets in, not schedule cycles).
 *
 * Shape: alliance_status carrier_specific + carrier list VERBATIM +
 * NO §36 (this is the defining Ryhmä 3 distinction). No PP/paid — these
 * are contract lounges, not commercial third-party.
 *
 * Lounges (6):
 *   CDG  Air France Lounge (SkyTeam op → oneworld JL)         [JL]
 *   DUB  Aer Lingus Lounge (EI left oneworld 2007 → BA+IB)    [BA,IB]
 *   MUC  Air France KLM Lounge (SkyTeam op → AY+IB)           [AY,IB]
 *   PVG  No. 39 - SAA Lounge (SA ex-Star op → JL)             [JL]
 *   PVG  No. 77 China Eastern Lounge (SkyTeam op → MH)        [MH]
 *   PVG  No. 77 China Eastern Plaza Premium Lounge (→ AY+IB)  [AY,IB]
 *
 * Total: 6 lounges, all business-class-equivalent (oneworld_sapphire).
 *
 * NOT included:
 *   FRA Air France/KLM lounge [IB] — FRA is on the "ask before touching"
 *     list of demo airports. Deferred to FRA review batch alongside the
 *     other FRA-specific decisions (Primeclass conflict, Priority Lounge).
 *
 * All 6 carriers already in `airlines` (AY, BA, IB, JL, MH from
 * pre-baseline / Phase 30). No new carrier seed.
 *
 * PVG note: NO.77 VIP LOUNGE from Batch 3a is a different physical lounge
 * ("Before Security", Ryhmä 1) than No. 77 China Eastern Plaza Premium
 * Lounge here (After Security, Ryhmä 3). Different names, different DB rows.
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results  (per-airport, primary)
 *   https://wwws.airfrance.com                       (AF lounges)
 *   https://www.aerlingus.com                        (EI lounge)
 *   https://us.klm.com                               (KLM/AFKLM lounges)
 *   https://www.ceair.com                            (China Eastern lounges)
 *   https://www.flysaa.com                           (SAA lounge)
 *
 * Idempotent per (airport_id, name).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_AF       = 'https://wwws.airfrance.com';
const SOURCE_EI       = 'https://www.aerlingus.com';
const SOURCE_AFKLM    = 'https://us.klm.com';
const SOURCE_MU       = 'https://www.ceair.com';
const SOURCE_SA       = 'https://www.flysaa.com';

const RYHMA_3_CONFIDENCE = 0.95;

interface LoungeSpec {
  iata:                string;
  name:                string;
  locationDescription: string;
  area:                'schengen' | 'non_schengen' | 'international' | 'all';
  carriers:            string[];  // verbatim from oneworld.com — NO §36
  sourceOperator:      string;
  ambigNote:           string;    // rationale for why this is a contract (Ryhmä 3)
}

const LOUNGES: LoungeSpec[] = [
  {
    iata: 'CDG', name: 'Air France Lounge',
    locationDescription: 'Terminal 2E, Hall K, Level 1, after security',
    area: 'all',
    carriers: ['JL'],
    sourceOperator: SOURCE_AF,
    ambigNote: 'AF is SkyTeam; contract lounge granting oneworld JAL passengers access',
  },
  {
    iata: 'DUB', name: 'Aer Lingus Lounge',
    locationDescription: 'Terminal 2, follow signs for Airline Lounges, after security',
    area: 'all',
    carriers: ['BA', 'IB'],
    sourceOperator: SOURCE_EI,
    ambigNote: 'EI left oneworld 2007; contract retained with BA and IB',
  },
  {
    iata: 'MUC', name: 'Air France KLM Lounge',
    locationDescription: 'Terminal 1, Area D, Level 5',
    area: 'all',
    carriers: ['AY', 'IB'],
    sourceOperator: SOURCE_AFKLM,
    ambigNote: 'AF/KL are SkyTeam; unusual contract with AY (Finnair) and IB (Iberia)',
  },
  {
    iata: 'PVG', name: 'No. 39 - SAA Lounge',
    locationDescription: 'Terminal 1, Gate 39, after security',
    area: 'all',
    carriers: ['JL'],
    sourceOperator: SOURCE_SA,
    ambigNote: 'SA (South African Airways) former Star member; contract with JL',
  },
  {
    iata: 'PVG', name: 'No. 77 China Eastern Lounge',
    locationDescription: 'Terminal 2, after security',
    area: 'all',
    carriers: ['MH'],
    sourceOperator: SOURCE_MU,
    ambigNote: 'MU (China Eastern) is SkyTeam; contract with MH (Malaysia Airlines)',
  },
  {
    iata: 'PVG', name: 'No. 77 China Eastern Plaza Premium Lounge',
    locationDescription: 'Terminal 2, Gate 77, after security',
    area: 'all',
    carriers: ['AY', 'IB'],
    sourceOperator: SOURCE_MU,
    ambigNote: 'MU × Plaza Premium co-branded contract; serves AY and IB',
  },
];

const airportIds: Record<string, number> = {};
for (const iata of ['CDG', 'DUB', 'MUC', 'PVG']) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) { console.error(`${iata} airport not found — aborting`); process.exit(1); }
  airportIds[iata] = row.id;
}

db.transaction(() => {
  let lI = 0, lS = 0, cI = 0, cS = 0;
  for (const spec of LOUNGES) {
    const airportId = airportIds[spec.iata];
    let loungeId: number;
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;
    if (existing) { loungeId = existing.id; console.log(`  ↩ ${spec.iata} ${spec.name}: id=${loungeId} — skip`); lS++; }
    else {
      const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, ?, 'premium', 'business', ?, NULL, ?)`)
        .run(airportId, spec.name, spec.locationDescription, spec.area, JSON.stringify(['Buffet', 'Bar', 'WiFi', 'Workspace']));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.iata} ${spec.name} (id=${loungeId}) — [${spec.carriers.join(',')}] — ${spec.ambigNote}`);
      lI++;
    }

    // Single alliance_status channel with carrier_specific + verbatim list
    const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = 'alliance_status' AND alliance_access = 'carrier_specific'`).get(loungeId) as { id: number } | undefined;
    if (existingCh) { cS++; continue; }
    const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, 'alliance_status', 'carrier_specific')`).run(loungeId);
    db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, 'oneworld_sapphire', ?, '2020-01-01', NULL, 100, ?, NULL, ?, ?)`)
      .run(chResult.lastInsertRowid, JSON.stringify(spec.carriers), RYHMA_3_CONFIDENCE, `${SOURCE_ONEWORLD} + ${spec.sourceOperator}`, TODAY);
    cI++;
  }
  console.log(`\nDone.  lounges: inserted=${lI} skipped=${lS}  channels: inserted=${cI} skipped=${cS}`);
  console.log(`Ryhmä 3 model: carrier_specific + verbatim list, NO §36 (contract, not seasonal).`);
})();
db.close();
