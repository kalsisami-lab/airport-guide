/**
 * Phase 20: Fix Finnair Lounge / Platinum Wing alliance rules at HEL.
 *
 * Bug: rules 1, 2, 3 all had `alliance_access='carrier_specific'` with
 * `carrier_restriction=['AY']`, which incorrectly limited access to Finnair
 * passengers only. Under oneworld rules, any oneworld status holder on any
 * oneworld carrier can access these lounges out of HEL.
 *
 * Sources (two-source verification per data-integrity-todos.md §14 lesson C):
 *   Primary: https://www.oneworld.com/airport-lounges
 *     "Sapphire tier frequent flyers are welcome in Business Class or frequent
 *      flyer lounges... marketed and operated by any oneworld member airline"
 *     "Emerald tier frequent flyers can use First Class, Business Class or
 *      frequent flyer lounges" on any oneworld flight
 *   Secondary: The Pointy Miles / HFP Finnair Platinum Wing reviews (2022–2024)
 *     "You do not need to be flying Finnair to access the Platinum Wing...
 *      The only requirement is that you be flying a oneworld carrier"
 *
 * Changes (idempotent: safe to re-run):
 *   Rule 1 (Platinum Wing, oneworld_emerald):
 *     alliance_access carrier_specific → all_alliance
 *     carrier_restriction ['AY'] → NULL
 *   Rules 2, 3 (Finnair Lounge non-Schengen + Schengen, oneworld_sapphire):
 *     same normalisation
 *
 * NOT changed: `airline_own` channels (id=40, 41, +others) with
 * carrier_restriction=['AY']. Those correctly model Finnair's own-airline
 * access policy, which is a separate access dimension from alliance status.
 *
 * NOT modelled: rumoured weekend restriction for Sapphires — single-source
 * claim, contradicts primary oneworld policy. See TODO §18.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounges';

// Channel IDs to fix + human-readable label for logging
const CHANNELS = [
  { channelId: 1, label: 'Finnair Platinum Wing (oneworld_emerald)' },
  { channelId: 2, label: 'Finnair Lounge non-Schengen (oneworld_sapphire)' },
  { channelId: 3, label: 'Finnair Lounge Schengen (oneworld_sapphire)' },
];

db.transaction(() => {
  for (const { channelId, label } of CHANNELS) {
    const current = db.prepare(`
      SELECT alliance_access FROM lounge_access_channels WHERE id = ?
    `).get(channelId) as { alliance_access: string | null } | undefined;

    if (!current) {
      console.log(`  ⚠ Channel ${channelId} not found — skipping ${label}`);
      continue;
    }

    if (current.alliance_access === 'all_alliance') {
      console.log(`  ↩ Channel ${channelId} already all_alliance — skipping ${label}`);
      continue;
    }

    db.prepare(`
      UPDATE lounge_access_channels
      SET alliance_access = 'all_alliance'
      WHERE id = ?
    `).run(channelId);

    db.prepare(`
      UPDATE lounge_access_rules
      SET carrier_restriction = NULL,
          source_url = ?,
          verified_at = ?
      WHERE channel_id = ?
    `).run(SOURCE_ONEWORLD, TODAY, channelId);

    console.log(`  ✓ Channel ${channelId}: carrier_specific → all_alliance, carrier ['AY'] → NULL — ${label}`);
  }
})();

db.close();
console.log('Done.');
