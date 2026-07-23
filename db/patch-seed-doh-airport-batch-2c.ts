/**
 * Phase 32 (Batch 2c) pre-req: Seed DOH (Hamad International, Doha) into airports.
 *
 * Required for the 6 QR Ryhmä 2 lounges at Doha (Al Mourjan × 2, Al Safwa,
 * Gold, Platinum, Silver — the whole QR hub cluster). DOH is not
 * currently in the airports table.
 *
 * Idempotent per iata_code.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);

const existing = db.prepare(`SELECT id FROM airports WHERE iata_code = 'DOH'`).get() as { id: number } | undefined;
if (existing) {
  console.log(`  ↩ DOH already in airports (id=${existing.id}) — skipping`);
} else {
  const result = db.prepare(`INSERT INTO airports (iata_code, name, city, country_code) VALUES ('DOH', 'Hamad International Airport', 'Doha', 'QA')`).run();
  console.log(`  ✓ Inserted DOH (Hamad International Airport, Doha, QA) into airports (id=${result.lastInsertRowid})`);
}
db.close();
