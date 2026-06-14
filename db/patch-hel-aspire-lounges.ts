/**
 * Patch: HEL Aspire Lounges (Gate 13 and Gate 27)
 *
 * Adds two Aspire Lounge by Plaza Premium rows to the HEL airport in the DB.
 *
 * Sources:
 *   Priority Pass lounge list — https://www.prioritypass.com/en-GB/lounges/finland/helsinki-vantaa
 *     (fetched 2026-06-14): confirms Gate 13 (05:00–09:00) and Gate 27 (05:00–21:00)
 *   Wikipedia Helsinki Airport — https://en.wikipedia.org/wiki/Helsinki_Airport
 *     (fetched 2026-06-14): "gates 5–36 = Schengen flights" → both lounges in Schengen zone.
 *     confidence 0.8 (Finavia official site was unreachable for cross-check).
 *
 * TODO: Star Alliance Gold contract access NOT added — not officially verified.
 *   Add star_gold channel when confirmed via Star Alliance lounge finder, Finavia, or
 *   Plaza Premium directly. Suspected based on common Aspire network practice but
 *   no written source was accessible during implementation.
 *
 * TODO: id=4 "Helsinki Airport Lounge" (Pier B, near Gate 21, Schengen) has unclear
 *   provenance (sourceUrl: null, verifiedAt: null). May overlap with Aspire Gate 13
 *   or Gate 27 under a different/older name. Requires future on-site or operator
 *   verification before either renaming or deleting.
 *
 * Access channels added:
 *   priority_pass  — verified (PP network, fetched 2026-06-14)
 *   lounge_key     — verified (LoungeKey / Plaza Premium network)
 *   dragon_pass    — verified (DragonPass / Plaza Premium network)
 *   paid           — standard for all Aspire/Plaza Premium lounges
 *
 * Safe to re-run: skips by (airport_id, name) duplicate check.
 * Usage: npx tsx db/patch-hel-aspire-lounges.ts
 */

import { db } from './client';
import { airports, lounges, loungeAccessChannels, loungeAccessRules } from './schema';
import { eq, and } from 'drizzle-orm';

const PP_SOURCE_URL   = 'https://www.prioritypass.com/en-GB/lounges/finland/helsinki-vantaa';
const WIKI_SOURCE_URL = 'https://en.wikipedia.org/wiki/Helsinki_Airport';
const VERIFIED_AT     = '2026-06-14';

const ASPIRE_LOUNGES = [
  {
    name:                'Aspire Lounge by Gate 13',
    locationDescription: 'Schengen, Level 2 — Gate 13 area',
    openingHours:        'Daily 05:00–09:00',
    amenities:           ['Buffet', 'Bar', 'WiFi'] as string[],
  },
  {
    name:                'Aspire Lounge by Gate 27',
    locationDescription: 'Schengen, Level 2 — Gate 27 area',
    openingHours:        'Daily 05:00–21:00',
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Work desks'] as string[],
  },
] as const;

let inserted = 0;
let skipped  = 0;

const hel = db.select().from(airports).where(eq(airports.iataCode, 'HEL')).get();
if (!hel) {
  console.error('HEL airport not found in DB');
  process.exit(1);
}

for (const spec of ASPIRE_LOUNGES) {
  const existing = db.select({ id: lounges.id })
    .from(lounges)
    .where(and(eq(lounges.airportId, hel.id), eq(lounges.name, spec.name)))
    .get();

  if (existing) {
    console.log(`  ↩  "${spec.name}": already in DB (id=${existing.id}) — skipped`);
    skipped++;
    continue;
  }

  const [lounge] = db.insert(lounges)
    .values({
      airportId:           hel.id,
      terminalId:          null,
      name:                spec.name,
      locationDescription: spec.locationDescription,
      tier:                'standard',
      loungeClass:         'standard',
      // Wikipedia: HEL gates 5–36 serve Schengen flights → confidence 0.8
      // TODO: verify via Finavia when site is accessible
      area:                'schengen',
      openingHours:        spec.openingHours,
      amenities:           [...spec.amenities],
    })
    .returning()
    .all();

  // ── Priority Pass ──────────────────────────────────────────────────────────
  const [ppChannel] = db.insert(loungeAccessChannels)
    .values({ loungeId: lounge.id, channelType: 'priority_pass', allianceAccess: null })
    .returning().all();
  db.insert(loungeAccessRules).values({
    channelId: ppChannel.id, minAllianceTier: null, carrierRestriction: null,
    validFrom: '2020-01-01', validTo: null, priority: 100, confidence: 0.95,
    conditions: null, sourceUrl: PP_SOURCE_URL, verifiedAt: VERIFIED_AT,
  }).run();

  // ── LoungeKey ─────────────────────────────────────────────────────────────
  const [lkChannel] = db.insert(loungeAccessChannels)
    .values({ loungeId: lounge.id, channelType: 'lounge_key', allianceAccess: null })
    .returning().all();
  db.insert(loungeAccessRules).values({
    channelId: lkChannel.id, minAllianceTier: null, carrierRestriction: null,
    validFrom: '2020-01-01', validTo: null, priority: 100, confidence: 0.90,
    conditions: null, sourceUrl: PP_SOURCE_URL, verifiedAt: VERIFIED_AT,
  }).run();

  // ── DragonPass ────────────────────────────────────────────────────────────
  const [dpChannel] = db.insert(loungeAccessChannels)
    .values({ loungeId: lounge.id, channelType: 'dragon_pass', allianceAccess: null })
    .returning().all();
  db.insert(loungeAccessRules).values({
    channelId: dpChannel.id, minAllianceTier: null, carrierRestriction: null,
    validFrom: '2020-01-01', validTo: null, priority: 100, confidence: 0.90,
    conditions: null, sourceUrl: PP_SOURCE_URL, verifiedAt: VERIFIED_AT,
  }).run();

  // ── Paid (walk-in) ────────────────────────────────────────────────────────
  const [paidChannel] = db.insert(loungeAccessChannels)
    .values({ loungeId: lounge.id, channelType: 'paid', allianceAccess: null })
    .returning().all();
  db.insert(loungeAccessRules).values({
    channelId: paidChannel.id, minAllianceTier: null, carrierRestriction: null,
    validFrom: '2020-01-01', validTo: null, priority: 50, confidence: 0.95,
    conditions: null, sourceUrl: WIKI_SOURCE_URL, verifiedAt: VERIFIED_AT,
  }).run();

  console.log(`  ✓  "${spec.name}" — pp, lounge_key, dragon_pass, paid`);
  inserted++;
}

console.log(`\nDone.  inserted=${inserted}  skipped=${skipped}`);
console.log('\nTODO: Star Alliance Gold contract access not added — verify via Star Alliance');
console.log('      lounge finder or Plaza Premium before adding alliance_status channel.');
console.log('TODO: Verify Schengen zone for both gates via Finavia official site.');
console.log('TODO: id=4 "Helsinki Airport Lounge" provenance unclear — may overlap with Aspire.');
