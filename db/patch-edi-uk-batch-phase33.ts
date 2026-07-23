/**
 * Phase 33 (UK Batch — EDI): Seed 2 Ryhmä 1 lounges.
 *
 * EDI is scraper-covered but user provided data manually for §51/§52
 * wording verification.
 *
 * EDI existing lounges pre-batch:
 *   British Airways Lounge — Ryhmä 2 all_alliance sapphire (Batch 2c, PR #10)
 *     Wording verified as "ANY oneworld" per §51 — no change needed.
 *
 * Lounges added by this batch (Ryhmä 1, area='all'):
 *   Aspire Lounge             [IB, AY]         §36
 *   Turkish Airlines Lounge   [AY, QR]         positive control (AY listed)
 *
 * Not seeded:
 *   No1 Lounge — TEMPORARILY CLOSED per oneworld.com (§55).
 *
 * Standard 5-channel Ryhmä 1 model. Both operators are on PP-network
 * (Aspire, Turkish Airlines Lounge co-branded).
 *
 * No new carriers (AY, IB, QR all in DB).
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=EDI
 *   https://www.executivelounges.com                            (Aspire)
 *   https://www.turkishairlines.com                             (TK lounge operator)
 *   https://www.prioritypass.com
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_PP       = 'https://www.prioritypass.com';
const SOURCE_ASPIRE   = 'https://www.executivelounges.com';
const SOURCE_TK       = 'https://www.turkishairlines.com';

interface Spec { name: string; carriers: string[]; operatorSource: string; }
const LOUNGES: Spec[] = [
  { name: 'Aspire Lounge',           carriers: ['IB', 'AY'], operatorSource: SOURCE_ASPIRE },  // §36
  { name: 'Turkish Airlines Lounge', carriers: ['AY', 'QR'], operatorSource: SOURCE_TK },      // positive control
];

const PREMIUM = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = 'EDI'`).get() as { id: number } | undefined;
if (!airportRow) { console.error('EDI airport not found — aborting'); process.exit(1); }
const airportId = airportRow.id;

db.transaction(() => {
  let lI = 0, lS = 0, cI = 0;
  for (const spec of LOUNGES) {
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;
    let loungeId: number;
    if (existing) { loungeId = existing.id; console.log(`  ↩ ${spec.name}: id=${loungeId} — skip`); lS++; }
    else {
      const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, 'Departures level, after security', 'premium', 'business', 'all', NULL, ?)`)
        .run(airportId, spec.name, JSON.stringify(PREMIUM));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ EDI ${spec.name} (id=${loungeId}, carriers=[${spec.carriers.join(',')}])`);
      lI++;
    }
    const channels: Array<{ type: string; access: 'carrier_specific' | null; tier: string | null; carriers: string[] | null; conf: number; src: string; }> = [
      { type: 'alliance_status', access: 'carrier_specific', tier: 'oneworld_sapphire', carriers: spec.carriers, conf: 0.95, src: SOURCE_ONEWORLD },
      { type: 'priority_pass',   access: null, tier: null, carriers: null, conf: 0.9,  src: SOURCE_PP },
      { type: 'lounge_key',      access: null, tier: null, carriers: null, conf: 0.85, src: SOURCE_PP },
      { type: 'dragon_pass',     access: null, tier: null, carriers: null, conf: 0.8,  src: SOURCE_PP },
      { type: 'paid',            access: null, tier: null, carriers: null, conf: 0.9,  src: spec.operatorSource },
    ];
    for (const ch of channels) {
      const existingCh = db.prepare(`SELECT id FROM lounge_access_channels WHERE lounge_id = ? AND channel_type = ? AND (alliance_access IS ? OR alliance_access = ?)`)
        .get(loungeId, ch.type, ch.access, ch.access) as { id: number } | undefined;
      if (existingCh) continue;
      const chResult = db.prepare(`INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access) VALUES (?, ?, ?)`).run(loungeId, ch.type, ch.access);
      const priority = ch.type === 'paid' ? 50 : 100;
      db.prepare(`INSERT INTO lounge_access_rules (channel_id, min_alliance_tier, carrier_restriction, valid_from, valid_to, priority, confidence, conditions, source_url, verified_at) VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, NULL, ?, ?)`)
        .run(chResult.lastInsertRowid, ch.tier, ch.carriers ? JSON.stringify(ch.carriers) : null, priority, ch.conf, ch.src, TODAY);
      cI++;
    }
  }
  console.log(`\nEDI done.  lounges: inserted=${lI} skipped=${lS}  channels: inserted=${cI}`);
})();
db.close();
