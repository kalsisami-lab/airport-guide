/**
 * Phase 32 (Batch 3e) pre-req: Seed FJ (Fiji Airways) into airlines.
 *
 * Fiji Airways is a oneworld connect associate (joined 2018), which
 * oneworld.com treats as a full member for lounge access purposes. It
 * appears in LAX Business Lounge carrier list [AA,BA,CX,FJ,AY,IB,JL,QF,QR]
 * — this is the only lounge in the entire scrape where FJ is listed.
 *
 * Without FJ in `airlines`, the engine's `getAllianceForCarrier` returns
 * null for an FJ operating flight and the allianceUnknown branch takes
 * over — flipping `allowed` to `likely_allowed`. Same fix pattern as
 * RJ + UL in Batch 3a.
 *
 * Sources:
 *   https://www.oneworld.com/members  (Fiji Airways listed under "oneworld connect")
 *   https://www.oneworld.com/oneworld-connect
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);

const ONEWORLD_ID = 1;

const existing = db.prepare(`SELECT id FROM airlines WHERE iata_code = 'FJ'`).get() as { id: number } | undefined;
if (existing) {
  console.log(`  ↩ FJ (Fiji Airways) already in airlines (id=${existing.id}) — skipping`);
} else {
  const result = db.prepare(`INSERT INTO airlines (iata_code, name, alliance_id) VALUES ('FJ', 'Fiji Airways', ?)`).run(ONEWORLD_ID);
  console.log(`  ✓ Inserted FJ (Fiji Airways) into airlines (id=${result.lastInsertRowid}, alliance=oneworld connect)`);
}
db.close();
