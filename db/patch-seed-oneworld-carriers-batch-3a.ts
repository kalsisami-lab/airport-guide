/**
 * Phase 32 (Batch 3a) pre-req: Seed 2 missing oneworld carriers into airlines.
 *
 * Both carriers appear as third-party lounge access carriers in the East
 * Asia Ryhmä 1 batch (HKG PP East Hall, ICN oneworld Lounge, SIN Dnata,
 * BKK Miracle Business). Without them in `airlines`, the engine's
 * `getAllianceForCarrier` returns null for an RJ/UL operating flight and
 * takes the allianceUnknown branch — returning `likely_allowed` where
 * `allowed` is correct.
 *
 * Carriers (both oneworld per oneworld.com/members):
 *   RJ  Royal Jordanian     (joined 2007-04-01)
 *   UL  SriLankan           (joined 2014-05-01)
 *
 * Same shape as patch-seed-oneworld-carriers-phase30.ts. Idempotent per
 * (iata_code).
 *
 * After this seed, oneworld member coverage in `airlines`:
 *   AA, AS, AT, AY, BA, CX, IB, JL, MH, QF, QR, RJ, UL, WY
 *   (13 current members + AT which is still listed but leaving in 2026Q4)
 *
 * Sources:
 *   https://www.oneworld.com/members
 *   https://www.oneworld.com/history
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);

const ONEWORLD_ID = 1;

const CARRIERS: Array<{ iata: string; name: string }> = [
  { iata: 'RJ', name: 'Royal Jordanian' },
  { iata: 'UL', name: 'SriLankan Airlines' },
];

let inserted = 0, skipped = 0;
for (const c of CARRIERS) {
  const existing = db.prepare(`SELECT id FROM airlines WHERE iata_code = ?`).get(c.iata) as { id: number } | undefined;
  if (existing) {
    console.log(`  ↩ ${c.iata} (${c.name}) already in airlines (id=${existing.id}) — skipping`);
    skipped++;
    continue;
  }
  const result = db.prepare(`
    INSERT INTO airlines (iata_code, name, alliance_id) VALUES (?, ?, ?)
  `).run(c.iata, c.name, ONEWORLD_ID);
  console.log(`  ✓ Inserted ${c.iata} (${c.name}) into airlines (id=${result.lastInsertRowid}, alliance=oneworld)`);
  inserted++;
}

db.close();
console.log(`\nDone.  carriers: inserted=${inserted} skipped=${skipped}`);
