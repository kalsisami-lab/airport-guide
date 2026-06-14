/**
 * Patch: Lufthansa First Class Lounge — Frankfurt (FRA)
 *
 * Fixes lounge_access_rules row for channel id=13 (airline_own, LH/LX/OS/SN).
 *
 * BUG: conditions was NULL, granting FCL access to ANY LH-group passenger
 *      regardless of cabin. Senator economy was incorrectly shown as "allowed".
 *
 * FIX: Add conditions = { op:'in', field:'passenger.cabin', values:['first'] }
 *      so only First Class ticket holders receive access via this rule.
 *
 * TODOs (not implemented here — need separate rules):
 *   - HON Circle members: add alliance_status channel with min_alliance_tier='star_hoc'
 *     when that tier is added to the tier hierarchy.
 *   - Senator + same-day First Class connection: requires a compound conditions
 *     predicate combining cabin of connecting flight (not yet modelled in engine).
 *
 * Source: https://www.lufthansa.com/de/en/lounges
 * Safe to re-run: UPDATE is idempotent.
 * Usage: npx tsx db/patch-lh-fcl-fra.ts
 */

import { db } from './client';
import { lounges, loungeAccessChannels, loungeAccessRules } from './schema';
import { airports } from './schema';
import { eq, and } from 'drizzle-orm';

const SOURCE_URL  = 'https://www.lufthansa.com/de/en/lounges';
const VERIFIED_AT = new Date().toISOString().slice(0, 10);

// ── Locate the lounge by name + airport IATA, not by hardcoded id ─────────────
const fra = db.select().from(airports).where(eq(airports.iataCode, 'FRA')).get();
if (!fra) {
  console.error('FRA airport not found in DB');
  process.exit(1);
}

const lounge = db.select().from(lounges)
  .where(and(
    eq(lounges.airportId, fra.id),
    eq(lounges.name, 'Lufthansa First Class Lounge'),
  ))
  .get();

if (!lounge) {
  console.error('Lufthansa First Class Lounge not found at FRA');
  process.exit(1);
}

// ── Find the airline_own channel ───────────────────────────────────────────────
const channel = db.select().from(loungeAccessChannels)
  .where(and(
    eq(loungeAccessChannels.loungeId, lounge.id),
    eq(loungeAccessChannels.channelType, 'airline_own'),
  ))
  .get();

if (!channel) {
  console.error(`No airline_own channel found for lounge id=${lounge.id}`);
  process.exit(1);
}

// ── Find the rule ──────────────────────────────────────────────────────────────
const rule = db.select().from(loungeAccessRules)
  .where(eq(loungeAccessRules.channelId, channel.id))
  .get();

if (!rule) {
  console.error(`No rule found for channel id=${channel.id}`);
  process.exit(1);
}

console.log(`Found: lounge id=${lounge.id} "${lounge.name}" → channel id=${channel.id} → rule id=${rule.id}`);
console.log(`  Before: conditions=${JSON.stringify(rule.conditions)} confidence=${rule.confidence}`);

// ── Apply fix ─────────────────────────────────────────────────────────────────
db.update(loungeAccessRules)
  .set({
    conditions:  { op: 'in', field: 'passenger.cabin', values: ['first'] },
    confidence:  0.95,
    sourceUrl:   SOURCE_URL,
    verifiedAt:  VERIFIED_AT,
  })
  .where(eq(loungeAccessRules.id, rule.id))
  .run();

const updated = db.select().from(loungeAccessRules)
  .where(eq(loungeAccessRules.id, rule.id))
  .get();

console.log(`  After:  conditions=${JSON.stringify(updated?.conditions)} confidence=${updated?.confidence}`);
console.log(`\nDone. LH FCL FRA now requires cabin=first.`);
console.log('TODO: Add separate HON Circle rule (alliance_status, star_hoc tier) when tier exists.');
console.log('TODO: Add Senator + same-day F-connection rule when compound conditions are modelled.');
