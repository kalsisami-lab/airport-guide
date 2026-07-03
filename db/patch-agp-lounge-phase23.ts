/**
 * Phase 23: Add Málaga (AGP) Sala VIP lounge.
 *
 * Simple leisure-destination model — no oneworld affiliation.
 *
 * Critical negative fact confirmed via oneworld.com lounge finder:
 *   "No lounges found for AGP" — AGP has no oneworld-affiliated lounge.
 * Therefore this lounge has NO alliance_status channel. An AY / BA / QR
 * passenger with oneworld status does NOT get `allowed` at Sala VIP based on
 * status alone; they see `paid_available` (walk-in) instead.
 *
 * Access channels:
 *   priority_pass    — PP network member (prioritypass.com)
 *   lounge_key       — inferred from PP network (§27)
 *   dragon_pass      — inferred from PP network (§27)
 *   paid             — unrestricted walk-in per Aena
 *
 * NOT added:
 *   alliance_status  — no oneworld/star/skyteam contract per oneworld.com
 *   amex_centurion   — Amex Platinum flows via PP channel (which they have)
 *
 * Sources:
 *   https://www.oneworld.com/airport-lounge-results?location=AGP (primary — negative)
 *   https://www.prioritypass.com/en-GB/lounges/spain/malaga (PP membership)
 *   https://www.aena.es/en/malaga-costa-del-sol/services/vip-lounge.html
 *
 * Opening hours: 05:30–22:30 chosen conservatively; Aena lists 00:00–23:59
 * which likely means "24h in principle" — see §26.
 *
 * Idempotent: skips by (airport_id, name); each channel guarded by
 * (lounge_id, channel_type).
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_PP    = 'https://www.prioritypass.com/en-GB/lounges/spain/malaga';
const SOURCE_AENA  = 'https://www.aena.es/en/malaga-costa-del-sol/services/vip-lounge.html';
const SOURCE_ONEWORLD_NEGATIVE = 'https://www.oneworld.com/airport-lounge-results?location=AGP (verified no oneworld lounge)';

interface ChannelSpec {
  channelType: string;
  priority:    number;
  confidence:  number;
  sourceUrl:   string;
}

const CHANNELS: ChannelSpec[] = [
  { channelType: 'priority_pass', priority: 100, confidence: 0.9,  sourceUrl: SOURCE_PP   },
  { channelType: 'lounge_key',    priority: 100, confidence: 0.85, sourceUrl: SOURCE_PP   },
  { channelType: 'dragon_pass',   priority: 100, confidence: 0.8,  sourceUrl: SOURCE_PP   },
  { channelType: 'paid',          priority: 50,  confidence: 0.9,  sourceUrl: SOURCE_AENA },
];

db.transaction(() => {
  const agp = db.prepare(`SELECT id FROM airports WHERE iata_code = 'AGP'`).get() as { id: number } | undefined;
  if (!agp) {
    console.error('AGP airport not found — aborting');
    process.exit(1);
  }

  let loungeId: number;
  const existing = db.prepare(`
    SELECT id FROM lounges WHERE airport_id = ? AND name = 'Sala VIP'
  `).get(agp.id) as { id: number } | undefined;

  if (existing) {
    loungeId = existing.id;
    console.log(`  ↩ Sala VIP already exists (id=${loungeId}) — skipping lounge insert`);
  } else {
    const result = db.prepare(`
      INSERT INTO lounges
        (airport_id, terminal_id, name, location_description,
         tier, lounge_class, area, opening_hours, amenities)
      VALUES (?, NULL, 'Sala VIP', ?, 'standard', 'standard', 'schengen', 'Daily 05:30–22:30', ?)
    `).run(
      agp.id,
      'Schengen — Terminal 3, boarding area Level 2 (T2 passengers also, terminals connected)',
      JSON.stringify(['Buffet', 'Bar', 'WiFi', 'Workspace', 'Shower']),
    );
    loungeId = Number(result.lastInsertRowid);
    console.log(`  ✓ Inserted Sala VIP (id=${loungeId})`);
  }

  let channelsInserted = 0, channelsSkipped = 0;

  for (const ch of CHANNELS) {
    const existingCh = db.prepare(`
      SELECT id FROM lounge_access_channels
      WHERE lounge_id = ? AND channel_type = ? AND alliance_access IS NULL
    `).get(loungeId, ch.channelType) as { id: number } | undefined;

    if (existingCh) {
      console.log(`    ↩ ${ch.channelType}: exists — skipping`);
      channelsSkipped++;
      continue;
    }

    const chResult = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (?, ?, NULL)
    `).run(loungeId, ch.channelType);

    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction,
         valid_from, valid_to, priority, confidence, conditions,
         source_url, verified_at)
      VALUES (?, NULL, NULL, '2020-01-01', NULL, ?, ?, NULL, ?, ?)
    `).run(chResult.lastInsertRowid, ch.priority, ch.confidence, ch.sourceUrl, TODAY);

    console.log(`    ✓ Added ${ch.channelType} (priority ${ch.priority}, conf ${ch.confidence})`);
    channelsInserted++;
  }

  console.log(`\nDone.  channels: inserted=${channelsInserted} skipped=${channelsSkipped}`);
  console.log(`Verified negative: no alliance_status channel added (oneworld.com: ${SOURCE_ONEWORLD_NEGATIVE})`);
})();

db.close();
