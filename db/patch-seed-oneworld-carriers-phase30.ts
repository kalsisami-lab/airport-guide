/**
 * Phase 30 (pre-req): Seed 5 missing oneworld carriers into airlines.
 *
 * Required for the Ryhmä 2 batches (airline-branded oneworld lounges,
 * all_alliance model — Phases 30/31/32) so that `getAllianceForCarrier`
 * returns 'oneworld' for these carriers. Without it, an operating-
 * carrier-based alliance derivation in the normalization path would
 * return null, and the engine's allianceUnknown branch would take over
 * — returning `likely_allowed` instead of the correct `allowed`.
 *
 * Carriers (all oneworld, per oneworld.com/members):
 *   CX  Cathay Pacific       (founding member, 1999)
 *   QF  Qantas               (founding member, 1999)
 *   MH  Malaysia Airlines    (joined 2013-02-01)
 *   AS  Alaska Airlines      (joined 2021-03-31)
 *   WY  Oman Air             (joined 2024-06-30)
 *
 * Sources:
 *   https://www.oneworld.com/members  (all five confirmed listed as of Phase 30)
 *   https://www.oneworld.com/history  (join dates)
 *
 * Same shape as Phase 21 SK seed (patch-seed-sk-sas.ts) and Phase 26
 * AT seed (patch-seed-at-ram.ts). Idempotent per (iata_code).
 *
 * Other oneworld carriers already in airlines pre-Phase 30:
 *   AA (id=6), AY (1), BA (2), IB (3), QR (4), JL (existing), AT (19 from Phase 26)
 * After this seed, the full oneworld member list is present in the DB.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);

const ONEWORLD_ID = 1;

const CARRIERS: Array<{ iata: string; name: string }> = [
  { iata: 'CX', name: 'Cathay Pacific' },
  { iata: 'QF', name: 'Qantas' },
  { iata: 'MH', name: 'Malaysia Airlines' },
  { iata: 'AS', name: 'Alaska Airlines' },
  { iata: 'WY', name: 'Oman Air' },
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
