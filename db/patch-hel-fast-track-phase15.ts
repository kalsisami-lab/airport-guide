/**
 * Phase 15: Add HEL fast_track_security rules for:
 *   - Finnair Plus Silver (oneworld_ruby, AY only)
 *   - Business / First class cabin
 *   - Amex Platinum Finland (amex_centurion provider)
 *   - Nordea Platinum + Black (nordea_fast_track provider)
 *   - Aktia Visa Infinite (aktia_fast_track provider)
 *
 * Existing rules (ids 1–3): oneworld_sapphire, star_gold, skyteam_elite_plus — unchanged.
 * Idempotent: safe to re-run.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);

// airport_id=1 is HEL
const HEL_ID = 1;
const TODAY  = new Date().toISOString().slice(0, 10);

const SOURCE_FINAVIA = 'https://www.finavia.fi/fi/lentokentat/helsinki-vantaa';
const SOURCE_AY      = 'https://www.finnair.com/fi/fi/finnair-plus/tietoa-ohjelmasta/edut';
const SOURCE_NORDEA  = 'https://www.nordea.fi/henkiloasiakkaat/tuotteet/kortit/nordea-black-kortti.html';
const SOURCE_AKTIA   = 'https://www.aktia.fi/fi/kortit/visa-infinite';

interface RuleRow { service_type: string; notes: string | null }

function ruleExists(notes: string): boolean {
  const row = db.prepare(
    `SELECT id FROM airport_service_rules WHERE airport_id = ? AND notes = ?`
  ).get(HEL_ID, notes) as RuleRow | undefined;
  return !!row;
}

db.transaction(() => {
  // 1. Finnair Plus Silver — oneworld_ruby, AY only
  if (!ruleExists('Finnair Plus Silver')) {
    db.prepare(`
      INSERT INTO airport_service_rules
        (airport_id, service_type, action, provider, min_alliance_tier,
         carrier_restriction, conditions, priority, confidence,
         valid_from, source_url, verified_at, notes)
      VALUES (?, 'fast_track_security', 'allow', NULL, 'oneworld_ruby',
              '["AY"]', NULL, 80, 0.95,
              '2020-01-01', ?, ?, 'Finnair Plus Silver')
    `).run(HEL_ID, SOURCE_AY, TODAY);
    console.log('✓ Added Finnair Plus Silver rule');
  } else {
    console.log('  Finnair Plus Silver rule already exists');
  }

  // 2. Business / First class cabin
  if (!ruleExists('Business/First class cabin')) {
    db.prepare(`
      INSERT INTO airport_service_rules
        (airport_id, service_type, action, provider, min_alliance_tier,
         carrier_restriction, conditions, priority, confidence,
         valid_from, source_url, verified_at, notes)
      VALUES (?, 'fast_track_security', 'allow', NULL, NULL,
              NULL, '{"op":"in","field":"passenger.cabin","values":["business","first"]}',
              70, 0.9,
              '2020-01-01', ?, ?, 'Business/First class cabin')
    `).run(HEL_ID, SOURCE_FINAVIA, TODAY);
    console.log('✓ Added Business/First class cabin rule');
  } else {
    console.log('  Business/First class cabin rule already exists');
  }

  // 3. Amex Platinum Finland
  if (!ruleExists('Amex Platinum Finland')) {
    db.prepare(`
      INSERT INTO airport_service_rules
        (airport_id, service_type, action, provider, min_alliance_tier,
         carrier_restriction, conditions, priority, confidence,
         valid_from, source_url, verified_at, notes)
      VALUES (?, 'fast_track_security', 'allow', 'amex_centurion', NULL,
              NULL, NULL, 60, 0.9,
              '2020-01-01', ?, ?, 'Amex Platinum Finland')
    `).run(HEL_ID, SOURCE_FINAVIA, TODAY);
    console.log('✓ Added Amex Platinum Finland rule');
  } else {
    console.log('  Amex Platinum Finland rule already exists');
  }

  // 4. Nordea (Platinum + Black)
  if (!ruleExists('Nordea Platinum / Black')) {
    db.prepare(`
      INSERT INTO airport_service_rules
        (airport_id, service_type, action, provider, min_alliance_tier,
         carrier_restriction, conditions, priority, confidence,
         valid_from, source_url, verified_at, notes)
      VALUES (?, 'fast_track_security', 'allow', 'nordea_fast_track', NULL,
              NULL, NULL, 60, 0.9,
              '2020-01-01', ?, ?, 'Nordea Platinum / Black')
    `).run(HEL_ID, SOURCE_NORDEA, TODAY);
    console.log('✓ Added Nordea Platinum / Black rule');
  } else {
    console.log('  Nordea Platinum / Black rule already exists');
  }

  // 5. Aktia Visa Infinite
  if (!ruleExists('Aktia Visa Infinite')) {
    db.prepare(`
      INSERT INTO airport_service_rules
        (airport_id, service_type, action, provider, min_alliance_tier,
         carrier_restriction, conditions, priority, confidence,
         valid_from, source_url, verified_at, notes)
      VALUES (?, 'fast_track_security', 'allow', 'aktia_fast_track', NULL,
              NULL, NULL, 60, 0.9,
              '2020-01-01', ?, ?, 'Aktia Visa Infinite')
    `).run(HEL_ID, SOURCE_AKTIA, TODAY);
    console.log('✓ Added Aktia Visa Infinite rule');
  } else {
    console.log('  Aktia Visa Infinite rule already exists');
  }
})();

db.close();
console.log('Done.');
