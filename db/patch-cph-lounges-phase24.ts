/**
 * Phase 24: Add Copenhagen (CPH) lounges.
 *
 * CPH is the second Nordic oneworld hub (after Phase 22 ARN) and the first
 * lounge seed that spans both Schengen and non-Schengen areas at the same
 * airport, so the physically_unreachable branch is exercised end-to-end.
 *
 * Four lounges:
 *   A. Danske Bank Aviator Business Lounge — schengen, oneworld [AY,IB]+LK/DP+paid
 *   B. Eventyr Lounge                       — non_schengen, oneworld [BA,QR]+PP/LK/DP+paid
 *   C. Aspire Lounge                        — schengen, PP/LK/DP+paid
 *   D. Carlsberg Aviator Lounge             — schengen, PP+paid
 *
 * Carrier-list divergence: Danske Bank = [AY,IB], Eventyr = [BA,QR]. AY is
 * only on Danske Bank; BA is only on Eventyr. This is the ARN Pearl T2/C37
 * pattern (Phase 22) applied across a Schengen/non-Schengen zone boundary.
 *
 * Zone matters here for the first time: a Finnair passenger on HEL→CPH
 * (Schengen inbound → Schengen area) can reach Danske Bank / Aspire /
 * Carlsberg but NOT Eventyr (non_schengen), which returns
 * physically_unreachable regardless of status.
 *
 * NOT added deliberately:
 *   SAS lounges — Star Alliance, non-Finnair-relevant (§31, same as ARN §24)
 *
 * Notes:
 *   - Eventyr is listed on oneworld.com under the name "Pearl Lounge".
 *     The lounge's public/operator name is Eventyr; alias noted in
 *     location_description (schema has no aliases column — §29).
 *   - Danske Bank Aviator has lounge_key and dragon_pass but NOT
 *     priority_pass — LK/DP-only lounges are unusual. Cross-check flagged
 *     in §29 alongside the alias note if a later source revises this.
 *   - Danske Bank customers (id=`danske-platinum` in creditCards.ts) reach
 *     Danske Bank Aviator via the lounge_key channel; a dedicated
 *     `bank_partner` channel is deferred to §30.
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=CPH (primary — carrier lists)
 *   https://www.cph.dk/en/practical/at-the-airport/lounges (opening hours + zones)
 *   https://www.prioritypass.com/en-GB/lounges/denmark/copenhagen (PP membership)
 *   https://www.americanexpress.com/en-gb/benefits/travel/airport-lounges (Amex Platinum PP)
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

const SOURCE_ONEWORLD  = 'https://www.oneworld.com/airport-lounge-results?location=CPH';
const SOURCE_CPH       = 'https://www.cph.dk/en/practical/at-the-airport/lounges';
const SOURCE_PP        = 'https://www.prioritypass.com/en-GB/lounges/denmark/copenhagen';
const SOURCE_AMEX      = 'https://www.americanexpress.com/en-gb/benefits/travel/airport-lounges';

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
    name:                'Danske Bank Aviator Business Lounge',
    locationDescription: 'Schengen — Terminal 2, between gates A and B, 1st floor',
    tier:                'premium',
    loungeClass:         'business',
    area:                'schengen',
    openingHours:        null,  // TODO §28 — cph.dk does not list hours for this lounge
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    channels: [
      {
        channelType: 'alliance_status', allianceAccess: 'carrier_specific',
        minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AY', 'IB'],
        priority: 100, confidence: 0.99, sourceUrl: SOURCE_ONEWORLD,
      },
      // Danske Bank Platinum (creditCards.ts:96) has loungeAccess: ['lounge-key'],
      // so LK grants access to the branded lounge. DP inferred from LK network
      // per §14/§27 pattern. PP intentionally omitted — Aviator Business Lounge
      // is not listed on prioritypass.com for CPH.
      { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_CPH },
      { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_CPH },
      { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_CPH },
    ],
  },
  {
    name:                'Eventyr Lounge',
    locationDescription: 'Non-Schengen — Terminal 3, Pier C, near Gate C26 (oneworld.com lists as "Pearl Lounge")',
    tier:                'standard',
    loungeClass:         'standard',
    area:                'non_schengen',
    openingHours:        'Daily 05:30–20:00',
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Shower', 'Workspace'],
    channels: [
      {
        channelType: 'alliance_status', allianceAccess: 'carrier_specific',
        minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['BA', 'QR'],
        priority: 100, confidence: 0.99, sourceUrl: SOURCE_ONEWORLD,
      },
      { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
      { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
      { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
      { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_CPH },
    ],
  },
  {
    name:                'Aspire Lounge',
    locationDescription: 'Schengen — Terminal 2, A-gates (opened 12/2025)',
    tier:                'standard',
    loungeClass:         'standard',
    area:                'schengen',
    openingHours:        'Daily 06:00–20:00',
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: [
      { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
      { channelType: 'lounge_key',    allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP },
      { channelType: 'dragon_pass',   allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP },
      { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_CPH },
    ],
  },
  {
    name:                'Carlsberg Aviator Lounge',
    locationDescription: 'Schengen — Terminal 2, A-B area (shares entrance with Danske Bank Aviator)',
    tier:                'standard',
    loungeClass:         'standard',
    area:                'schengen',
    openingHours:        null,  // TODO §28 — cph.dk does not list hours for this lounge
    amenities:           ['Buffet', 'Bar', 'WiFi', 'Workspace'],
    channels: [
      { channelType: 'priority_pass', allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP },
      { channelType: 'paid',          allianceAccess: null, minAllianceTier: null, carrierRestriction: null, priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_CPH },
    ],
  },
];

db.transaction(() => {
  const cph = db.prepare(`SELECT id FROM airports WHERE iata_code = 'CPH'`).get() as { id: number } | undefined;
  if (!cph) {
    console.error('CPH airport not found — aborting');
    process.exit(1);
  }

  let loungesInserted = 0, loungesSkipped = 0, channelsInserted = 0, channelsSkipped = 0;

  for (const spec of LOUNGES) {
    let loungeId: number;
    const existing = db.prepare(`
      SELECT id FROM lounges WHERE airport_id = ? AND name = ?
    `).get(cph.id, spec.name) as { id: number } | undefined;

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
        cph.id, spec.name, spec.locationDescription, spec.tier, spec.loungeClass,
        spec.area, spec.openingHours, JSON.stringify(spec.amenities),
      );
      loungeId = Number(result.lastInsertRowid);
      console.log(`  ✓ Inserted ${spec.name} (id=${loungeId}, area=${spec.area})`);
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
      console.log(`    ✓ Added ${ch.channelType}${carrierNote} (priority ${ch.priority}, conf ${ch.confidence})`);
      channelsInserted++;
    }
  }

  console.log(`\nDone.  lounges: inserted=${loungesInserted} skipped=${loungesSkipped}  channels: inserted=${channelsInserted} skipped=${channelsSkipped}`);
  console.log(`Amex Platinum reaches Aspire/Carlsberg/Eventyr via PP (${SOURCE_AMEX}); Eventyr is non-Schengen only.`);
})();

db.close();
