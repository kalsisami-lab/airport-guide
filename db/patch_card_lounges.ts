/**
 * Patch: card-perk lounges
 *
 * Seeds Amex Centurion, Priority Pass, LoungeKey, and DragonPass lounges
 * from data/cardAndPerksData.ts into the entitlement database.
 *
 * Safe to re-run: skips any lounge that already exists (matched by airport_id + name).
 * Only seeds lounges for airports already present in the DB (currently DXB, FRA, HEL, JFK, LHR).
 * Lounges for other airports in cardAndPerksData.ts are logged as skipped — they require
 * their airport row to be inserted first.
 *
 * Usage: npx tsx db/patch_card_lounges.ts
 */

import { db } from './client';
import { airports, lounges, loungeAccessChannels, loungeAccessRules } from './schema';
import { eq, and } from 'drizzle-orm';
import { AMEX_LOUNGES, PRIORITY_PASS_LOUNGES } from '../data/cardAndPerksData';
import type { StaticLounge } from '../data/lounges/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_URL  = 'internal: card perks data import';
const VERIFIED_AT = '2026-05-31';

// ─── Network → DB channel type ────────────────────────────────────────────────

type CardChannelType = 'amex_centurion' | 'priority_pass' | 'lounge_key' | 'dragon_pass';

const NETWORK_TO_CHANNEL: Record<string, CardChannelType> = {
  'amex-centurion': 'amex_centurion',
  'priority-pass':  'priority_pass',
  'lounge-key':     'lounge_key',
  'dragon-pass':    'dragon_pass',
};

// ─── Area normalisation ───────────────────────────────────────────────────────
// Static data uses 'non-schengen' (hyphen); DB enum uses 'non_schengen' (underscore).

function normalizeArea(
  area: StaticLounge['area'],
): 'schengen' | 'non_schengen' | 'international' | 'all' {
  return area === 'non-schengen' ? 'non_schengen' : area;
}

// ─── Merge AMEX + PP into a single map, deduplicated by static id ─────────────

function buildMergedMap(): Map<string, StaticLounge[]> {
  const merged = new Map<string, StaticLounge[]>();

  for (const [iata, list] of [
    ...Object.entries(AMEX_LOUNGES),
    ...Object.entries(PRIORITY_PASS_LOUNGES),
  ]) {
    if (!merged.has(iata)) merged.set(iata, []);
    for (const sl of list) {
      if (!merged.get(iata)!.some((x) => x.id === sl.id)) {
        merged.get(iata)!.push(sl);
      }
    }
  }

  return merged;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const cardLoungeMap = buildMergedMap();
let inserted = 0;
let skipped  = 0;
let missing  = 0;

const dbAirports = db.select().from(airports).all();

console.log(`\nDB airports: ${dbAirports.map((a) => a.iataCode).join(', ')}`);
console.log(`Static airports with card lounges: ${[...cardLoungeMap.keys()].sort().join(', ')}\n`);

for (const [iata, staticLoungeList] of cardLoungeMap) {
  const airportRow = dbAirports.find((a) => a.iataCode === iata);

  if (!airportRow) {
    console.log(`  ⚠  ${iata}: airport not in DB — ${staticLoungeList.length} lounge(s) skipped`);
    missing += staticLoungeList.length;
    continue;
  }

  for (const sl of staticLoungeList) {
    const channels = sl.networks
      .map((n) => NETWORK_TO_CHANNEL[n])
      .filter((ch): ch is CardChannelType => ch !== undefined);

    if (channels.length === 0) {
      console.log(`  ⚠  ${iata} "${sl.name}": no mappable networks [${sl.networks.join(', ')}] — skipped`);
      skipped++;
      continue;
    }

    // Skip if a lounge with this name already exists at this airport
    const existing = db
      .select({ id: lounges.id })
      .from(lounges)
      .where(and(eq(lounges.airportId, airportRow.id), eq(lounges.name, sl.name)))
      .get();

    if (existing) {
      console.log(`  ↩  ${iata} "${sl.name}": already in DB (id=${existing.id}) — skipped`);
      skipped++;
      continue;
    }

    // Insert lounge row
    const [loungeRow] = db
      .insert(lounges)
      .values({
        airportId:           airportRow.id,
        terminalId:          null,   // static data has terminal names, not DB terminal IDs
        name:                sl.name,
        locationDescription: sl.locationDescription,
        tier:                sl.tier  as 'ultra_premium' | 'premium' | 'standard',
        loungeClass:         sl.loungeClass as 'first' | 'business' | 'standard',
        area:                normalizeArea(sl.area),
        openingHours:        sl.openingHours,
        amenities:           sl.amenities,
      })
      .returning()
      .all();

    // One channel + one rule per network
    for (const channelType of channels) {
      const [channelRow] = db
        .insert(loungeAccessChannels)
        .values({
          loungeId:       loungeRow.id,
          channelType,
          allianceAccess: null,
        })
        .returning()
        .all();

      db.insert(loungeAccessRules)
        .values({
          channelId:          channelRow.id,
          minAllianceTier:    null,
          carrierRestriction: null,
          validFrom:          '2024-01-01',
          validTo:            null,
          priority:           100,
          confidence:         0.95,
          conditions:         null,
          sourceUrl:          SOURCE_URL,
          verifiedAt:         VERIFIED_AT,
        })
        .run();
    }

    console.log(`  ✓  ${iata} "${sl.name}" [${channels.join(', ')}]`);
    inserted++;
  }
}

console.log(
  `\nDone.  inserted=${inserted}  skipped=${skipped}  missing-airport=${missing}`,
);
