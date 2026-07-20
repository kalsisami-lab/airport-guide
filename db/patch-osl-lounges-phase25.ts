/**
 * Phase 25: Add Oslo-Gardermoen (OSL) lounges.
 *
 * OSL is the third and final Nordic oneworld hub added in this session
 * (after Phase 22 ARN and Phase 24 CPH). Structurally the simplest of the
 * three: both lounges are Schengen (no zone split), a single oneworld
 * carrier list covers both (no ARN Pearl T2/C37-style divergence), and
 * neither lounge is on the Priority Pass network.
 *
 * The PP-negative is the point of this phase. OSL Lounge is oneworld-only
 * (Sapphire) + Amex + walk-in — no PP/LK/DP. A Priority-Pass card holder
 * arrives at OSL and gets `paid_available` (walk-in fallback), not
 * `allowed`. Contrast:
 *   - AGP Sala VIP (Phase 23): PP holder → `allowed` via PP network
 *   - CPH Aspire  (Phase 24): PP holder → `allowed` via PP network
 *   - OSL Lounge  (this):     PP holder → `paid_available` (no PP channel)
 *
 * Two lounges:
 *   A. OSL Lounge          — Sapphire tier, walk-in open
 *   B. OSL Premium Lounge  — Emerald tier, no walk-in (Amex-only fallback)
 *
 * Same oneworld carrier list [BA,AY,IB,QR] on both, per oneworld.com. Amex
 * is a direct amex_centurion channel on both — same model as ARN Amex
 * Lounge (Phase 22). Amex Platinum reaches both via the amex-platinum →
 * amex_centurion map in hooks/useEntitlements.ts:31; Platinum/Centurion
 * distinction deferred to §33.
 *
 * NOT added deliberately:
 *   SAS lounges — Star Alliance, non-Finnair-relevant (§34, same as §24/§31)
 *   Norwegian bank cards (some grant OSL Lounge access) — not in
 *     creditCards.ts catalog yet, TODO §34
 *   priority_pass / lounge_key / dragon_pass — confirmed absent from OSL
 *     Lounge per multiple sources; this is the phase's key negative fact
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=OSL (primary — carrier list)
 *   https://www.americanexpress.com/en-gb/benefits/travel/airport-lounges (Amex on both lounges + Premium hours)
 *   https://avinor.no/en/airport/oslo-airport (opening hours)
 *
 * Idempotent: skips by (airport_id, name); each channel guarded by
 * (lounge_id, channel_type, alliance_access).
 *
 * Uses raw better-sqlite3 per project convention for DB patches.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_ONEWORLD = 'https://www.oneworld.com/airport-lounge-results?location=OSL';
const SOURCE_AMEX     = 'https://www.americanexpress.com/en-gb/benefits/travel/airport-lounges';
const SOURCE_AVINOR   = 'https://avinor.no/en/airport/oslo-airport';

const ONEWORLD_CARRIERS = ['BA', 'AY', 'IB', 'QR'];  // per oneworld.com OSL — same list for both lounges

interface ChannelSpec {
  channelType:        string;
  allianceAccess:     'all_alliance' | 'carrier_specific' | null;
  minAllianceTier:    string | null;
  carrierRestriction: string[] | null;
  priority:           number;
  confidence:         number;
  sourceUrl:          string;
}

interface LoungeSpec {
  name:                string;
  locationDescription: string;
  tier:                'ultra_premium' | 'premium' | 'standard';
  loungeClass:         'first' | 'business' | 'standard';
  area:                'schengen' | 'non_schengen' | 'international' | 'all';
  openingHours:        string | null;
  amenities:           string[];
  channels:            ChannelSpec[];
}

const LOUNGES: LoungeSpec[] = [
  {
    name:                'OSL Lounge',
    locationDescription: 'Schengen — International Terminal, above shopping area before gate E8',
    tier:                'premium',
    loungeClass:         'business',
    area:                'schengen',
    openingHours:        'Mon-Fri 05:30–20:30',
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    channels: [
      {
        channelType: 'alliance_status', allianceAccess: 'carrier_specific',
        minAllianceTier: 'oneworld_sapphire', carrierRestriction: ONEWORLD_CARRIERS,
        priority: 100, confidence: 0.99, sourceUrl: SOURCE_ONEWORLD,
      },
      // Direct Amex channel — not via Priority Pass. OSL Lounge is not on
      // the PP network (see file-level comment). Amex Platinum reaches this
      // via useEntitlements amex-platinum → amex_centurion map.
      { channelType: 'amex_centurion', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9, sourceUrl: SOURCE_AMEX },
      { channelType: 'paid',           allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9, sourceUrl: SOURCE_AVINOR },
    ],
  },
  {
    name:                'OSL Premium Lounge',
    locationDescription: 'Schengen — International Terminal, above OSL Lounge, before gate E8',
    tier:                'ultra_premium',
    loungeClass:         'first',
    area:                'schengen',
    openingHours:        'Mon-Fri 09:00–19:00, Sat closed, Sun 12:00–19:00',
    amenities:           ['Buffet', 'Champagne bar', 'WiFi', 'Shower', 'Workspace', 'Quiet room'],
    channels: [
      {
        channelType: 'alliance_status', allianceAccess: 'carrier_specific',
        minAllianceTier: 'oneworld_emerald', carrierRestriction: ONEWORLD_CARRIERS,
        priority: 100, confidence: 0.99, sourceUrl: SOURCE_ONEWORLD,
      },
      { channelType: 'amex_centurion', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9, sourceUrl: SOURCE_AMEX },
      // No `paid` channel — Premium Lounge has no walk-in per Avinor.
      // Non-Amex, non-Emerald passenger → `denied`, not `paid_available`.
    ],
  },
];

db.transaction(() => {
  const osl = db.prepare(`SELECT id FROM airports WHERE iata_code = 'OSL'`).get() as { id: number } | undefined;
  if (!osl) {
    console.error('OSL airport not found — aborting');
    process.exit(1);
  }

  let loungesInserted = 0, loungesSkipped = 0, channelsInserted = 0, channelsSkipped = 0;

  for (const spec of LOUNGES) {
    let loungeId: number;
    const existing = db.prepare(`
      SELECT id FROM lounges WHERE airport_id = ? AND name = ?
    `).get(osl.id, spec.name) as { id: number } | undefined;

    if (existing) {
      loungeId = existing.id;
      console.log(`  ↩ ${spec.name}: already in DB (id=${loungeId}) — skipping lounge insert`);
      loungesSkipped++;
    } else {
      const result = db.prepare(`
        INSERT INTO lounges
          (airport_id, terminal_id, name, location_description,
           tier, lounge_class, area, opening_hours, amenities)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        osl.id, spec.name, spec.locationDescription, spec.tier, spec.loungeClass,
        spec.area, spec.openingHours, JSON.stringify(spec.amenities),
      );
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ Inserted ${spec.name} (id=${loungeId}, tier=${spec.tier})`);
      loungesInserted++;
    }

    for (const ch of spec.channels) {
      const existingCh = db.prepare(`
        SELECT id FROM lounge_access_channels
        WHERE lounge_id = ? AND channel_type = ?
          AND (alliance_access IS ? OR alliance_access = ?)
      `).get(loungeId, ch.channelType, ch.allianceAccess, ch.allianceAccess) as { id: number } | undefined;

      if (existingCh) {
        console.log(`    ↩ ${ch.channelType}/${ch.allianceAccess ?? '—'}: exists — skipping`);
        channelsSkipped++;
        continue;
      }

      const chResult = db.prepare(`
        INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
        VALUES (?, ?, ?)
      `).run(loungeId, ch.channelType, ch.allianceAccess);

      db.prepare(`
        INSERT INTO lounge_access_rules
          (channel_id, min_alliance_tier, carrier_restriction,
           valid_from, valid_to, priority, confidence, conditions,
           source_url, verified_at)
        VALUES (?, ?, ?, '2020-01-01', NULL, ?, ?, NULL, ?, ?)
      `).run(
        chResult.lastInsertRowid,
        ch.minAllianceTier,
        ch.carrierRestriction ? JSON.stringify(ch.carrierRestriction) : null,
        ch.priority, ch.confidence, ch.sourceUrl, TODAY,
      );

      const carrierNote = ch.carrierRestriction ? ` [${ch.carrierRestriction.join(',')}]` : '';
      const tierNote    = ch.minAllianceTier ? ` (${ch.minAllianceTier})` : '';
      console.log(`    ✓ Added ${ch.channelType}${carrierNote}${tierNote} (priority ${ch.priority}, conf ${ch.confidence})`);
      channelsInserted++;
    }
  }

  console.log(`\nDone.  lounges: inserted=${loungesInserted} skipped=${loungesSkipped}  channels: inserted=${channelsInserted} skipped=${channelsSkipped}`);
  console.log(`Verified negative: no priority_pass/lounge_key/dragon_pass on either lounge (${SOURCE_ONEWORLD}, ${SOURCE_AMEX})`);
})();

db.close();
