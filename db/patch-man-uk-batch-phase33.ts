/**
 * Phase 33 (UK Batch — MAN): Seed 6 Ryhmä 1 lounges.
 *
 * MAN is scraper-covered (in iatas.txt) but user provided the data
 * manually to guarantee §51/§52 wording-based classification. All 6
 * lounges use "THESE oneworld only" wording → Ryhmä 1 model.
 *
 * All area='all' (UK).
 *
 *   T2  1903 Lounge                        [QR, AY]              §36
 *   T2  Aspire                             [AY]                  positive control
 *   T1  Aspire Lounge                      [AT, AY]              §36
 *   T2  Escape Lounge Terminal 2           [BA, IB, QR, AY]      §36
 *   T1  The Escape Lounge Terminal 1       [IB, AY]              §36
 *   T2  The Executive by Escape Lounges    [CX, AY]              §36
 *
 * Standard 5-channel Ryhmä 1 model. All lounges are PP-network operators
 * (1903 Lounge / Aspire / Escape Lounge brands) → PP/LK/DP channels
 * included with standard confidence tiering.
 *
 * No new carriers (AT, AY, BA, CX, IB, QR all in DB).
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=MAN
 *   https://www.1903-lounge.com                                 (1903 Lounge)
 *   https://www.executivelounges.com                            (Aspire)
 *   https://www.escapelounges.com                               (Escape / Executive by Escape)
 *   https://www.prioritypass.com                                (PP network)
 *
 * Idempotent per (airport_id, name).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results';
const SOURCE_PP       = 'https://www.prioritypass.com';
const SOURCE_1903     = 'https://www.1903-lounge.com';
const SOURCE_ASPIRE   = 'https://www.executivelounges.com';
const SOURCE_ESCAPE   = 'https://www.escapelounges.com';

interface Spec {
  name: string; terminal: string; carriers: string[]; operatorSource: string;
}

const LOUNGES: Spec[] = [
  { name: '1903 Lounge',                     terminal: 'T2', carriers: ['QR', 'AY'],             operatorSource: SOURCE_1903 },    // §36
  { name: 'Aspire',                          terminal: 'T2', carriers: ['AY'],                   operatorSource: SOURCE_ASPIRE },  // positive control
  { name: 'Aspire Lounge',                   terminal: 'T1', carriers: ['AT', 'AY'],             operatorSource: SOURCE_ASPIRE },  // §36
  { name: 'Escape Lounge Terminal 2',        terminal: 'T2', carriers: ['BA', 'IB', 'QR', 'AY'], operatorSource: SOURCE_ESCAPE },  // §36
  { name: 'The Escape Lounge Terminal 1',    terminal: 'T1', carriers: ['IB', 'AY'],             operatorSource: SOURCE_ESCAPE },  // §36
  { name: 'The Executive by Escape Lounges', terminal: 'T2', carriers: ['CX', 'AY'],             operatorSource: SOURCE_ESCAPE },  // §36
];

const PREMIUM = ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'];

const airportRow = db.prepare(`SELECT id FROM airports WHERE iata_code = 'MAN'`).get() as { id: number } | undefined;
if (!airportRow) { console.error('MAN airport not found — aborting'); process.exit(1); }
const airportId = airportRow.id;

db.transaction(() => {
  let lI = 0, lS = 0, cI = 0;
  for (const spec of LOUNGES) {
    const existing = db.prepare(`SELECT id FROM lounges WHERE airport_id = ? AND name = ?`).get(airportId, spec.name) as { id: number } | undefined;
    let loungeId: number;
    if (existing) { loungeId = existing.id; console.log(`  ↩ ${spec.name}: id=${loungeId} — skip`); lS++; }
    else {
      const locationDesc = `${spec.terminal}, after security`;
      const result = db.prepare(`INSERT INTO lounges (airport_id, terminal_id, name, location_description, tier, lounge_class, area, opening_hours, amenities) VALUES (?, NULL, ?, ?, 'premium', 'business', 'all', NULL, ?)`)
        .run(airportId, spec.name, locationDesc, JSON.stringify(PREMIUM));
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ MAN ${spec.name} (id=${loungeId}, ${spec.terminal}, carriers=[${spec.carriers.join(',')}])`);
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
  console.log(`\nMAN done.  lounges: inserted=${lI} skipped=${lS}  channels: inserted=${cI}`);
})();
db.close();
