/**
 * Phase 21: Seed SK (SAS — Scandinavian Airlines) into the airlines table.
 *
 * Required so that `getAllianceForCarrier('SK') = 'star_alliance'`, which lets
 * the engine correctly distinguish "carrier is on a different alliance"
 * (allianceMismatch → not_applicable) from "carrier is unknown / no flight"
 * (allianceUnknown → likely_allowed).
 *
 * SAS is a founding member of Star Alliance since 1997.
 * Source: https://www.staralliance.com/en/member-airlines
 *
 * Other unseeded Star/SkyTeam members (SN, OZ, MU, KE, RO, etc.) are tracked
 * in data-integrity-todos.md §19; only SK is seeded here to support Phase 21
 * test cases without expanding scope.
 *
 * Idempotent: skips if SK already exists.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);

const STAR_ALLIANCE_ID = 2;

const existing = db.prepare(`SELECT id FROM airlines WHERE iata_code = 'SK'`).get() as { id: number } | undefined;

if (existing) {
  console.log(`  ↩ SK already in airlines table (id=${existing.id}) — skipping`);
} else {
  const result = db.prepare(`
    INSERT INTO airlines (iata_code, name, alliance_id) VALUES ('SK', 'SAS', ?)
  `).run(STAR_ALLIANCE_ID);
  console.log(`  ✓ Inserted SK (SAS) into airlines (id=${result.lastInsertRowid}, alliance=star_alliance)`);
}

db.close();
console.log('Done.');
