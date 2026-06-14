/**
 * Patch: Finnair Lounge business/first class airline_own access
 *
 * Adds an airline_own channel + cabin condition to both Finnair Lounge rows (HEL):
 *   id=2 — non-Schengen side (Terminal 2)
 *   id=3 — Schengen side (Terminal 1)
 *
 * Rule: AY operating carrier + cabin in [business, first] → access granted.
 * Safe to re-run: skips if airline_own channel already exists for the lounge.
 *
 * Usage: npx tsx db/patch-finnair-cabin-rules.ts
 */

import { db } from './client';
import { lounges, loungeAccessChannels, loungeAccessRules } from './schema';
import { eq, and } from 'drizzle-orm';

const SOURCE_URL  = 'https://www.finnair.com/en/fly-finnair/lounges';
const VERIFIED_AT = '2026-06-14';

const FINNAIR_LOUNGE_IDS = [2, 3];  // non-Schengen and Schengen sides

let inserted = 0;
let skipped  = 0;

for (const loungeId of FINNAIR_LOUNGE_IDS) {
  const lounge = db.select({ name: lounges.name })
    .from(lounges)
    .where(eq(lounges.id, loungeId))
    .get();

  if (!lounge) {
    console.log(`  ⚠  lounge id=${loungeId} not found — skipped`);
    skipped++;
    continue;
  }

  // Skip if airline_own channel already exists for this lounge
  const existing = db.select({ id: loungeAccessChannels.id })
    .from(loungeAccessChannels)
    .where(and(
      eq(loungeAccessChannels.loungeId, loungeId),
      eq(loungeAccessChannels.channelType, 'airline_own'),
    ))
    .get();

  if (existing) {
    console.log(`  ↩  "${lounge.name}" (id=${loungeId}): airline_own channel already exists — skipped`);
    skipped++;
    continue;
  }

  const [channel] = db.insert(loungeAccessChannels)
    .values({
      loungeId,
      channelType:    'airline_own',
      allianceAccess: null,
    })
    .returning()
    .all();

  db.insert(loungeAccessRules)
    .values({
      channelId:          channel.id,
      minAllianceTier:    null,
      carrierRestriction: ['AY'],
      validFrom:          '2020-01-01',
      validTo:            null,
      priority:           90,           // lower than alliance_status (100) — status wins
      confidence:         0.95,
      conditions:         { op: 'in', field: 'passenger.cabin', values: ['business', 'first'] },
      sourceUrl:          SOURCE_URL,
      verifiedAt:         VERIFIED_AT,
    })
    .run();

  console.log(`  ✓  "${lounge.name}" (id=${loungeId}): airline_own + cabin condition added`);
  inserted++;
}

console.log(`\nDone.  inserted=${inserted}  skipped=${skipped}`);
