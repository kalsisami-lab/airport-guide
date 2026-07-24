/**
 * Patch: mark §59-documented "no lounge exists" airports as verified_none
 *
 * Case B / §67 initial verification pass. Only airports classified in §59 (a)
 * ("No lounge exists — nothing to seed") are marked verified_none in this
 * patch. Documentation lives in docs/data-integrity-todos.md §59 — that is
 * the primary source for this coverage assertion, per the §67 requirement
 * that a coverage-status change is a per-airport claim needing a source
 * the same way a lounge row does.
 *
 * Airports set to verified_none (3):
 *   BOO  Bodø
 *   KKN  Kirkenes
 *   TOS  Tromsø
 *
 * §59 also documents GZP (closed lounge, may reopen) and TRD (SAS lounge
 * exists, non-oneworld). Neither is verified_none — GZP has infrastructure
 * that's temporarily inoperable, TRD has a working lounge that's out of
 * this app's oneworld scope. Both remain 'unverified' and are called out
 * in §67 as explicit non-verified_none exceptions.
 *
 * Safe to re-run: skips rows already at verified_none.
 *
 * Usage: npx tsx db/patch-coverage-verified-none-59.ts
 */

import { db } from './client';
import { airports } from './schema';
import { eq } from 'drizzle-orm';

const SOURCE_URL  = 'https://github.com/kalsisami-lab/airport-guide/blob/main/docs/data-integrity-todos.md#59-ryhm%C3%A4-4-pp-only-airports--investigation-results-closed';
const VERIFIED_AT = '2026-07-24';

const VERIFIED_NONE_IATAS = ['BOO', 'KKN', 'TOS'] as const;

let updated = 0;
let skipped = 0;

for (const iata of VERIFIED_NONE_IATAS) {
  const row = db.select({
      id:     airports.id,
      name:   airports.name,
      status: airports.loungeCoverageStatus,
    })
    .from(airports)
    .where(eq(airports.iataCode, iata))
    .get();

  if (!row) {
    console.log(`  ⚠  ${iata}: not in airports table — skipped`);
    skipped++;
    continue;
  }

  if (row.status === 'verified_none') {
    console.log(`  ↩  ${iata} (${row.name}): already verified_none — skipped`);
    skipped++;
    continue;
  }

  db.update(airports)
    .set({
      loungeCoverageStatus: 'verified_none',
      coverageVerifiedAt:   VERIFIED_AT,
      coverageSourceUrl:    SOURCE_URL,
    })
    .where(eq(airports.id, row.id))
    .run();

  console.log(`  ✓  ${iata} (${row.name}): unverified → verified_none`);
  updated++;
}

console.log(`\nDone.  updated=${updated}  skipped=${skipped}`);
