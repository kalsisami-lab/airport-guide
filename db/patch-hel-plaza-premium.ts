/**
 * Phase 16: Add Plaza Premium Lounge at HEL (non-Schengen).
 *
 * Resolves data-integrity-todos.md §6 (OP-card access at Plaza Premium HEL) and
 * §9 (Plaza Premium HEL not yet in DB).
 *
 * Sources:
 *   Finavia: https://www.finavia.fi/fi/lentoasemat/helsinki-vantaa
 *     Hours: 06:00–00:00. Location: Non-Schengen, Mezzanine Level, near Gate 40.
 *   Plaza Premium official brochure (PPL_HEL_Departures_26.pdf).
 *     Confirms operator, amenities, "Book online" / "Charges may apply" → paid + walk-in.
 *
 * Access channels added (all confidence 0.9 → engine returns `allowed` when a rule matches):
 *   priority_pass  — Plaza Premium is a PP network member (PP owns DragonPass)
 *   lounge_key     — Plaza Premium is a LoungeKey network member
 *   dragon_pass    — Plaza Premium OWNS DragonPass
 *   op_card        — OP Group article (1/2025): non-Schengen equivalent of OP Lounge
 *   paid           — "Charges may apply" / walk-in per brochure
 *
 * Deliberately NOT added:
 *   alliance_status — no primary source confirming Star/oneworld/SkyTeam access
 *   amex_centurion  — no primary source
 *
 * Uses raw better-sqlite3 because DB has `channel_type='op_card'` which is not
 * in the Drizzle enum in `db/schema.ts`. See data-integrity-todos.md §13 (schema drift).
 *
 * Idempotent: skips by (airport_id, name) lounge check; each channel is guarded
 * by (lounge_id, channel_type, alliance_access).
 *
 * Usage: npx tsx db/patch-hel-plaza-premium.ts
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_FINAVIA = 'https://www.finavia.fi/fi/lentoasemat/helsinki-vantaa';
const SOURCE_PPL_PDF = 'Plaza Premium official brochure (PPL_HEL_Departures_26.pdf)';

const CHANNELS: Array<{
  channelType: string;
  confidence:  number;
  sourceUrl:   string;
}> = [
  { channelType: 'priority_pass', confidence: 0.9, sourceUrl: SOURCE_PPL_PDF },
  { channelType: 'lounge_key',    confidence: 0.9, sourceUrl: SOURCE_PPL_PDF },
  { channelType: 'dragon_pass',   confidence: 0.9, sourceUrl: SOURCE_PPL_PDF },
  { channelType: 'op_card',       confidence: 0.9, sourceUrl: SOURCE_FINAVIA },
  { channelType: 'paid',          confidence: 0.9, sourceUrl: SOURCE_PPL_PDF },
];

db.transaction(() => {
  const hel = db.prepare(`SELECT id FROM airports WHERE iata_code = 'HEL'`).get() as { id: number } | undefined;
  if (!hel) {
    console.error('HEL airport not found in DB — aborting');
    process.exit(1);
  }

  // 1. Insert lounge (idempotent on airport_id + name)
  const existing = db.prepare(`
    SELECT id FROM lounges
    WHERE airport_id = ? AND name = 'Plaza Premium Lounge'
  `).get(hel.id) as { id: number } | undefined;

  let loungeId: number;
  if (existing) {
    loungeId = existing.id;
    console.log(`  ↩ Plaza Premium Lounge already exists (id=${loungeId}) — skipping lounge insert`);
  } else {
    const result = db.prepare(`
      INSERT INTO lounges
        (airport_id, terminal_id, name, location_description,
         tier, lounge_class, area, opening_hours, amenities)
      VALUES (?, NULL, 'Plaza Premium Lounge', ?, 'standard', 'standard',
              'non_schengen', 'Daily 06:00–00:00', ?)
    `).run(
      hel.id,
      'Non-Schengen, Mezzanine Level — near Gate 40',
      JSON.stringify(['Buffet', 'Bar', 'Shower', 'GoSleep pods', 'WiFi', 'Workspace', 'Kids area']),
    );
    loungeId = Number(result.lastInsertRowid);
    console.log(`  ✓ Inserted Plaza Premium Lounge (id=${loungeId})`);
  }

  // 2. Insert each channel + rule (idempotent on lounge_id + channel_type)
  let channelsInserted = 0;
  let channelsSkipped  = 0;

  for (const spec of CHANNELS) {
    const existingCh = db.prepare(`
      SELECT id FROM lounge_access_channels
      WHERE lounge_id = ? AND channel_type = ? AND alliance_access IS NULL
    `).get(loungeId, spec.channelType) as { id: number } | undefined;

    if (existingCh) {
      console.log(`    ↩ ${spec.channelType} channel exists — skipping`);
      channelsSkipped++;
      continue;
    }

    const ch = db.prepare(`
      INSERT INTO lounge_access_channels (lounge_id, channel_type, alliance_access)
      VALUES (?, ?, NULL)
    `).run(loungeId, spec.channelType);

    db.prepare(`
      INSERT INTO lounge_access_rules
        (channel_id, min_alliance_tier, carrier_restriction,
         valid_from, valid_to, priority, confidence, conditions,
         source_url, verified_at)
      VALUES (?, NULL, NULL, '2020-01-01', NULL, 100, ?, NULL, ?, ?)
    `).run(ch.lastInsertRowid, spec.confidence, spec.sourceUrl, TODAY);

    console.log(`    ✓ Added ${spec.channelType} channel (conf ${spec.confidence})`);
    channelsInserted++;
  }

  console.log(`\nDone.  channels inserted=${channelsInserted}  skipped=${channelsSkipped}`);
})();

db.close();
