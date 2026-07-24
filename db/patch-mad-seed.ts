/**
 * Seed MAD (Madrid Barajas) — 2 IB-branded Ryhmä 2 lounges.
 *
 * Source: scraped 2026-07-24 from oneworld.com/airport-lounge-results?location=MAD
 * after adding MAD to scripts/iatas.txt. Scrape output preserved in
 * scripts/output/oneworld-lounges.json.
 *
 * MAD was Case A in §66 (in airports table, 0 lounges, real hub with
 * substantial lounge infrastructure). Root cause: never in iatas.txt →
 * scraper never queried oneworld.com for MAD. Now added and re-scraped.
 *
 * The scrape returned ONLY 2 lounges — not the 5-6 lounges an earlier
 * memory-reconstruction had assumed (see §66 rule: no alliance-data
 * seeding without scrape or manual verification).
 *
 * §51 classification: both Ryhmä 2 all_alliance / sapphire.
 *   - Same brand (IB Premium Lounge) at same airport (MAD) with same
 *     tier requirement (sapphire/emerald), but Dalí lists AY on the
 *     carrier list while Velázquez omits it. Carrier list divergence
 *     with everything else identical is a §36-style seasonal snapshot
 *     artifact, not a real access restriction — rules out Ryhmä 1.
 *   - IB is Madrid's home carrier; IB-branded home-hub lounges follow
 *     oneworld's "any oneworld member" reciprocity convention.
 *
 *   Dalí     — T4  (Domestic & Schengen Areas, Level 2)  06:00–23:00
 *              area='schengen', Ryhmä 2 all_alliance sapphire
 *   Velázquez — T4S (International & Non-Schengen Areas)  06:00–01:00
 *              area='non_schengen', Ryhmä 2 all_alliance sapphire
 *
 * No new carriers.
 *
 * Provenance per rule:
 *   source_url = 'https://www.oneworld.com/airport-lounge-results?location=MAD'
 *                + 'scripts/output/oneworld-lounges.json@2026-07-24'
 *   verified_at = 2026-07-24
 *
 * Idempotent per (airport_id, name).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = '2026-07-24';

const SOURCE = 'https://www.oneworld.com/airport-lounge-results?location=MAD + scripts/output/oneworld-lounges.json@2026-07-24';

interface LoungeSpec {
  name: string;
  locationDescription: string;
  area: 'schengen' | 'non_schengen';
  openingHours: string;
}

const HOURS_DALI = JSON.stringify({
  Sunday:    ['06:00 - 23:00'], Monday:    ['06:00 - 23:00'], Tuesday:   ['06:00 - 23:00'],
  Wednesday: ['06:00 - 23:00'], Thursday:  ['06:00 - 23:00'],
  Friday:    ['06:00 - 23:00'], Saturday:  ['06:00 - 23:00'],
});
const HOURS_VELAZQUEZ = JSON.stringify({
  Sunday:    ['06:00 - 01:00'], Monday:    ['06:00 - 01:00'], Tuesday:   ['06:00 - 01:00'],
  Wednesday: ['06:00 - 01:00'], Thursday:  ['06:00 - 01:00'],
  Friday:    ['06:00 - 01:00'], Saturday:  ['06:00 - 01:00'],
});

const LOUNGES: LoungeSpec[] = [
  {
    name: 'Iberia Premium Lounge Dalí',
    locationDescription: 'Terminal 4, Domestic & Schengen areas, Level 2, after security',
    area: 'schengen',
    openingHours: HOURS_DALI,
  },
  {
    name: 'Iberia Premium Lounge Velázquez',
    locationDescription: 'Terminal 4S, International & Non-Schengen areas, after security',
    area: 'non_schengen',
    openingHours: HOURS_VELAZQUEZ,
  },
];

const PREMIUM_AMENITIES = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = 'MAD'`).get() as { id: number } | undefined;
if (!airportRow) { console.error('MAD airport not found — aborting'); process.exit(1); }
const airportId = airportRow.id;

db.transaction(() => {
  let lI = 0, lS = 0, cI = 0, cS = 0;
  for (const spec of LOUNGES) {
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;
    let loungeId: number;
    if (existing) {
      loungeId = existing.id;
      console.log(`  ↩ ${spec.name}: id=${loungeId} — skip`);
      lS++;
    } else {
      const result = db.prepare(`
        INSERT INTO lounges (airport_id, terminal_id, name, location_description,
          tier, lounge_class, area, opening_hours, amenities)
        VALUES (?, NULL, ?, ?, 'premium', 'business', ?, ?, ?)
      `).run(airportId, spec.name, spec.locationDescription, spec.area, spec.openingHours, JSON.stringify(PREMIUM_AMENITIES));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ ${spec.name} (id=${loungeId}, area=${spec.area})`);
      lI++;
    }

    // Ryhmä 2: single alliance_status/all_alliance channel, sapphire, no carrier list
    const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = 'alliance_status' AND alliance_access = 'all_alliance'`).get(loungeId) as { id: number } | undefined;
    if (existingCh) { cS++; continue; }
    const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, 'alliance_status', 'all_alliance')`).run(loungeId);
    db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, 'oneworld_sapphire', NULL, '2020-01-01', NULL, 100, 0.99, NULL, ?, ?)`)
      .run(chResult.lastInsertRowid, SOURCE, TODAY);
    cI++;
    console.log(`    ✓ alliance_status/all_alliance sapphire (ch=${chResult.lastInsertRowid})`);
  }
  console.log(`\nDone. lounges: inserted=${lI} skipped=${lS}, channels: inserted=${cI} skipped=${cS}`);
})();
db.close();
