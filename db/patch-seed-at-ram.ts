/**
 * Phase 26 (pre-req): Seed AT (Royal Air Maroc) into the airlines table.
 *
 * Required so `getAllianceForCarrier('AT') = 'oneworld'`, which lets the
 * engine correctly evaluate AT-operated flights against oneworld
 * carrier_restriction lists at VLC Joan Olivert (id=42) and LPA Sala
 * Galdos (id=43) — both seeded in Phase 26 with 'AT' in their oneworld
 * carrier lists.
 *
 * Royal Air Maroc joined oneworld on 2020-04-01.
 * Source: https://www.oneworld.com/members/royal-air-maroc
 *
 * Same shape as Phase 21 SK seed (patch-seed-sk-sas.ts). Other unseeded
 * oneworld / Star / SkyTeam carriers remain tracked in
 * docs/data-integrity-todos.md §19.
 *
 * Idempotent: skips if AT already exists.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);

const ONEWORLD_ID = 1;

const existing = db.prepare(`SELECT id FROM airlines WHERE iata_code = 'AT'`).get() as { id: number } | undefined;

if (existing) {
  console.log(`  ↩ AT already in airlines table (id=${existing.id}) — skipping`);
} else {
  const result = db.prepare(`
    INSERT INTO airlines (iata_code, name, alliance_id) VALUES ('AT', 'Royal Air Maroc', ?)
  `).run(ONEWORLD_ID);
  console.log(`  ✓ Inserted AT (Royal Air Maroc) into airlines (id=${result.lastInsertRowid}, alliance=oneworld)`);
}

db.close();
console.log('Done.');
