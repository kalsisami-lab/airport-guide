/**
 * Integration test — runs against the committed db/entitlements.sqlite.
 * Verifies DB-first airport search surfaces §67-relevant IATAs (GZP/TRD/BOO)
 * that the static data/airports.ts dropdown source does not contain.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'fs';
import { join } from 'path';
import { searchAirports } from '../searchAirports';

const DB_PATH = join(process.cwd(), 'db', 'entitlements.sqlite');

if (!existsSync(DB_PATH)) {
  console.error('✗ db/entitlements.sqlite not found — run: npm run db:migrate && npm run db:seed');
  process.exit(1);
}

describe('searchAirports (DB-first)', () => {

  test('IATA-exact query "GZP" surfaces GZP (§67 unverified, not in data/airports.ts)', () => {
    const results = searchAirports('GZP');
    const gzp = results.find((a) => a.iata === 'GZP');
    assert.ok(gzp, 'GZP should be returned for IATA-exact query');
    assert.equal(gzp!.country, 'Turkey');
    assert.equal(gzp!.inSchengen, false);
  });

  test('IATA-exact query "TRD" surfaces TRD (§67 unverified, not in data/airports.ts)', () => {
    const results = searchAirports('TRD');
    const trd = results.find((a) => a.iata === 'TRD');
    assert.ok(trd, 'TRD should be returned for IATA-exact query');
    assert.equal(trd!.country, 'Norway');
    assert.equal(trd!.inSchengen, true);   // NO is in Schengen
  });

  test('IATA-exact query "BOO" surfaces BOO (§67 verified_none)', () => {
    const results = searchAirports('BOO');
    const boo = results.find((a) => a.iata === 'BOO');
    assert.ok(boo, 'BOO should be returned');
    assert.equal(boo!.country, 'Norway');
  });

  test('IATA-prefix query "GZ" surfaces GZP (short-prefix branch)', () => {
    const results = searchAirports('GZ');
    assert.ok(results.some((a) => a.iata === 'GZP'), 'GZ prefix should match GZP');
  });

  test('city query "Tromsø" surfaces TOS (name/city LIKE branch)', () => {
    const results = searchAirports('Tromsø');
    assert.ok(results.some((a) => a.iata === 'TOS'), 'Tromsø city query should match TOS');
  });

  test('query below 2 chars returns empty (min-length guard)', () => {
    assert.deepEqual(searchAirports('G'),  []);
    assert.deepEqual(searchAirports(''),   []);
    assert.deepEqual(searchAirports(' '),  []);
  });

  test('limit is honored', () => {
    // Use a 2-char query that hits many rows.
    const many = searchAirports('an', 5);
    assert.ok(many.length <= 5, 'limit=5 should cap results');
  });

  test('IATA-prefix hits rank ahead of substring hits', () => {
    // "AR" is an IATA prefix (ARN Stockholm etc.); also appears in names
    // like "Charles de Gaulle". Prefix hits should come first.
    const results = searchAirports('AR', 12);
    if (results.length > 1) {
      const firstIsPrefixHit = results[0].iata.startsWith('AR');
      assert.ok(firstIsPrefixHit, `First result "${results[0].iata}" should be an IATA-prefix hit`);
    }
  });

  test('shape matches Airport type (all required fields present)', () => {
    const [row] = searchAirports('HEL');
    assert.equal(typeof row.iata,       'string');
    assert.equal(typeof row.name,       'string');
    assert.equal(typeof row.city,       'string');
    assert.equal(typeof row.country,    'string');
    assert.equal(typeof row.terminal,   'string');
    assert.equal(typeof row.inSchengen, 'boolean');
  });
});
