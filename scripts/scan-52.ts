import * as fs from 'node:fs';
import Database from 'better-sqlite3';
import path from 'path';

const data = JSON.parse(fs.readFileSync('scripts/output/oneworld-lounges.json', 'utf-8'));
const db = new Database(path.join(process.cwd(), 'db/entitlements.sqlite'), { readonly: true });

// Build (iata, name) → scrape tiers map
interface Lounge { name: string; tiers: string[] }
const scrapeMap = new Map<string, string[]>();
for (const iata of Object.keys(data as Record<string, { lounges?: Lounge[] }>)) {
  for (const l of (data[iata].lounges || [])) {
    scrapeMap.set(iata + '|' + l.name, l.tiers || []);
  }
}

interface DBRow {
  iata: string; lounge_name: string; lounge_class: string;
  min_alliance_tier: string | null; alliance_access: string | null; channel_type: string;
}
const dbRows = db.prepare(`
  SELECT a.iata_code AS iata, l.name AS lounge_name, l.lounge_class,
         r.min_alliance_tier, c.alliance_access, c.channel_type
  FROM lounges l
  JOIN lounge_access_channels c ON c.lounge_id = l.id
  JOIN lounge_access_rules r ON r.channel_id = c.id
  JOIN airports a ON a.id = l.airport_id
  WHERE c.channel_type = 'alliance_status' AND c.alliance_access = 'all_alliance'
`).all() as DBRow[];

const findings: Array<{ iata: string; name: string; loungeClass: string; dbTier: string; scrapeTiers: string[] }> = [];

for (const r of dbRows) {
  const key = r.iata + '|' + r.lounge_name;
  const scrapeTiers = scrapeMap.get(key);
  if (!scrapeTiers) continue; // not in scrape — skip (UK, DOH, etc.)

  // If scrape says ONLY emerald but DB min_tier is sapphire (or lower) → too permissive
  const scrapeEmeraldOnly = scrapeTiers.length === 1 && scrapeTiers[0] === 'emerald';
  const dbIsSapphireOrLower = r.min_alliance_tier === 'oneworld_sapphire' || r.min_alliance_tier === 'oneworld_ruby';

  if (scrapeEmeraldOnly && dbIsSapphireOrLower) {
    findings.push({
      iata: r.iata, name: r.lounge_name, loungeClass: r.lounge_class,
      dbTier: r.min_alliance_tier ?? 'null', scrapeTiers,
    });
  }
}

console.log('=== §52 audit — all_alliance lounges where scrape says emerald-only but DB min_tier is lower ===');
console.log();
if (findings.length === 0) {
  console.log('  (none — all all_alliance lounges have correct emerald floor where scrape says so)');
} else {
  for (const f of findings) {
    console.log('  ' + f.iata + '  ' + f.name);
    console.log('     lounge_class: ' + f.loungeClass + '  DB min_tier: ' + f.dbTier + '  scrape tiers: [' + f.scrapeTiers.join(',') + ']');
  }
}
console.log();
console.log('Total findings: ' + findings.length);

db.close();
