/**
 * §68 Fast-track backfill (Finnair source, oneworld branch).
 *
 * Seeds airport_service_rules for fast_track_security at 58 airports
 * listed on Finnair's priority-turvatarkastus page (2026-07-26).
 *
 * Three access classes → different rule shapes:
 *
 *   FULL (46 airports) — 3 rules per airport:
 *     Rule 1  oneworld_sapphire + [AY] + alliance_defined + allow  (pri 110)
 *             AY-scope status path — Finnair Plus Gold+ / oneworld Sapphire+
 *             on AY-operated flight.
 *     Rule 2  oneworld_emerald  + <no carrier> + alliance_defined + allow  (pri 90)
 *             oneworld reciprocity — external oneworld Emerald on any oneworld
 *             carrier (the "oneworld Emerald ✓" column on Finnair's table).
 *     Rule 3  cabin business/first + [AY] + local + allow  (pri 100)
 *             AY-scope cabin path — Business Flex/Classic/Saver on AY-op flight.
 *
 *   FULL_NO_OW_EMERALD (GDN, TLL, WAW — 3 airports) — Rules 1 + 3 only:
 *     Finnair's Emerald column is blank at these airports. Silence per §63:
 *     absence ≠ deny. External oneworld Emerald pax → `not_enough_info` (?)
 *     until a source (BA, QR, oneworld doc) says otherwise. Do NOT add an
 *     explicit deny — that would over-claim.
 *
 *   FULL_NO_FP_SILVER (FLR — 1 airport) — Rules 1 + 2 + 3 (identical to FULL
 *     for this batch):
 *     Finnair's FP Silver column is blank. FP Silver = oneworld_ruby; under
 *     Rule 1 (min_tier=sapphire), Ruby fails tier check → §64 tier deny fires
 *     → denied. Correct outcome for FLR. When a future PR adds §65-style Ruby
 *     [AY] exception to AY-network airports, **FLR must be excluded** from
 *     that list — see §65 note.
 *
 *   BIZ_ONLY (8 airports: BKK, DOH, DXB, DUB, KIX, PVG, HND, YYZ) — 2 rules:
 *     Rule 3 (allow) — cabin business/first + [AY] + local  (pri 100)
 *     Rule 5α (deny) — oneworld_sapphire + [AY] + alliance_defined + deny
 *                      + condition: NOT cabin business/first  (pri 100)
 *     Model α (see §68): Sapphire+ economy AY → denied (source: Finnair's
 *     empty status columns at these airports are authoritative absence).
 *     Statukseton economy AY → not_enough_info (?). β-model (broader deny
 *     that also catches statukseton) was rejected because it fragilises
 *     future paid-add-on rule seeding. Documented in §68 as deliberate.
 *
 * §36 (AY-lisäys): verified against db/seed-finnair-airports.ts Phase 20
 * network. All 58 airports are Finnair-network (they wouldn't be on
 * Finnair's own page otherwise) — but §36 governs *external* oneworld
 * carrier lounges adding AY. That's about lounges, not services. For fast
 * track service rules, [AY] is the source-verified scope directly per
 * Finnair's page.
 *
 * HEL / LHR / JFK: not touched — existing fast_track_security rules already
 * cover Sapphire+ oneworld at these airports (HEL id=1 broader; LHR id=4
 * carrier list incl. AY; JFK id=6 broader).
 *
 * Source: internal-ref:finnair-priority-turvatarkastus/2026-07-26 (user
 * pasted verbatim; live URL was 404 at fetch time — see §65 stale-URL TODO).
 *
 * Idempotency: per (airport_id, service_type, notes). Notes text encodes the
 * rule's semantic identity in this batch — safe to re-run.
 *
 * Usage: npx tsx db/patch-fast-track-finnair-oneworld-backfill.ts
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
const db = new Database(DB_PATH);
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCE_URL = 'internal-ref:finnair-priority-turvatarkastus/2026-07-26';

const NOTES_R1 = 'Finnair oneworld Sapphire+ on AY-operated flight (§68)';
const NOTES_R2 = 'oneworld Emerald reciprocity, any oneworld carrier (§68)';
const NOTES_R3 = 'Business/First cabin on AY-operated flight (§68)';
const NOTES_R5 = 'AY oneworld Sapphire+ economy denied (BIZ_ONLY airport, §68 α)';

type AccessClass = 'FULL' | 'FULL_NO_FP_SILVER' | 'FULL_NO_OW_EMERALD' | 'BIZ_ONLY';

const AIRPORTS: Array<{ iata: string; access: AccessClass }> = [
  // FULL (46)
  { iata: 'ALC', access: 'FULL' },
  { iata: 'AMS', access: 'FULL' },
  { iata: 'BCN', access: 'FULL' },
  { iata: 'BGO', access: 'FULL' },
  { iata: 'BER', access: 'FULL' },
  { iata: 'BLL', access: 'FULL' },
  { iata: 'BRU', access: 'FULL' },
  { iata: 'BUD', access: 'FULL' },
  { iata: 'CTA', access: 'FULL' },
  { iata: 'CPH', access: 'FULL' },
  { iata: 'DUS', access: 'FULL' },
  { iata: 'EDI', access: 'FULL' },
  { iata: 'FRA', access: 'FULL' },
  { iata: 'FNC', access: 'FULL' },
  { iata: 'GVA', access: 'FULL' },
  { iata: 'GOT', access: 'FULL' },
  { iata: 'HAM', access: 'FULL' },
  { iata: 'KRK', access: 'FULL' },
  { iata: 'LIS', access: 'FULL' },
  { iata: 'LJU', access: 'FULL' },
  { iata: 'MAD', access: 'FULL' },
  { iata: 'AGP', access: 'FULL' },
  { iata: 'MAN', access: 'FULL' },
  { iata: 'LIN', access: 'FULL' },
  { iata: 'MXP', access: 'FULL' },
  { iata: 'MUC', access: 'FULL' },
  { iata: 'NAP', access: 'FULL' },
  { iata: 'OSL', access: 'FULL' },
  { iata: 'PMI', access: 'FULL' },
  { iata: 'CDG', access: 'FULL' },
  { iata: 'PRG', access: 'FULL' },
  { iata: 'KEF', access: 'FULL' },
  { iata: 'RIX', access: 'FULL' },
  { iata: 'FCO', access: 'FULL' },
  { iata: 'SIN', access: 'FULL' },
  { iata: 'SVG', access: 'FULL' },
  { iata: 'ARN', access: 'FULL' },
  { iata: 'SKG', access: 'FULL' },
  { iata: 'TIA', access: 'FULL' },
  { iata: 'NRT', access: 'FULL' },
  { iata: 'TRN', access: 'FULL' },
  { iata: 'VLC', access: 'FULL' },
  { iata: 'VRN', access: 'FULL' },
  { iata: 'VIE', access: 'FULL' },
  { iata: 'VNO', access: 'FULL' },
  { iata: 'ZRH', access: 'FULL' },
  // FULL_NO_FP_SILVER (1)
  { iata: 'FLR', access: 'FULL_NO_FP_SILVER' },
  // FULL_NO_OW_EMERALD (3)
  { iata: 'GDN', access: 'FULL_NO_OW_EMERALD' },
  { iata: 'TLL', access: 'FULL_NO_OW_EMERALD' },
  { iata: 'WAW', access: 'FULL_NO_OW_EMERALD' },
  // BIZ_ONLY (8)
  { iata: 'BKK', access: 'BIZ_ONLY' },
  { iata: 'DOH', access: 'BIZ_ONLY' },
  { iata: 'DXB', access: 'BIZ_ONLY' },
  { iata: 'DUB', access: 'BIZ_ONLY' },
  { iata: 'KIX', access: 'BIZ_ONLY' },
  { iata: 'PVG', access: 'BIZ_ONLY' },
  { iata: 'HND', access: 'BIZ_ONLY' },
  { iata: 'YYZ', access: 'BIZ_ONLY' },
];

// Sanity check: 46 FULL + 1 FLR + 3 NO_OW_EMERALD + 8 BIZ_ONLY = 58.
if (AIRPORTS.length !== 58) {
  console.error(`Expected 58 airports, got ${AIRPORTS.length}`);
  process.exit(1);
}

// ── Rule builders — always fast_track_security ─────────────────────────────

interface RuleSpec {
  minAllianceTier: string | null;
  carrierRestriction: string[] | null;
  tierSemantics: 'alliance_defined' | 'local';
  action: 'allow' | 'deny';
  conditions: Record<string, unknown> | null;
  priority: number;
  confidence: number;
  notes: string;
}

const CABIN_BIZ_FIRST_COND = {
  op: 'in', field: 'passenger.cabin', values: ['business', 'first'],
} as const;

const NOT_CABIN_BIZ_FIRST_COND = {
  op: 'not',
  condition: CABIN_BIZ_FIRST_COND,
} as const;

const RULE_1: RuleSpec = {
  minAllianceTier:    'oneworld_sapphire',
  carrierRestriction: ['AY'],
  tierSemantics:      'alliance_defined',
  action:             'allow',
  conditions:         null,
  priority:           110,
  confidence:         0.95,
  notes:              NOTES_R1,
};

const RULE_2: RuleSpec = {
  minAllianceTier:    'oneworld_emerald',
  carrierRestriction: null,
  tierSemantics:      'alliance_defined',
  action:             'allow',
  conditions:         null,
  priority:           90,
  confidence:         0.95,
  notes:              NOTES_R2,
};

const RULE_3: RuleSpec = {
  minAllianceTier:    null,
  carrierRestriction: ['AY'],
  tierSemantics:      'local',
  action:             'allow',
  conditions:         CABIN_BIZ_FIRST_COND,
  priority:           100,
  confidence:         0.9,
  notes:              NOTES_R3,
};

const RULE_5A: RuleSpec = {
  minAllianceTier:    'oneworld_sapphire',
  carrierRestriction: ['AY'],
  tierSemantics:      'alliance_defined',
  action:             'deny',
  conditions:         NOT_CABIN_BIZ_FIRST_COND,
  priority:           100,
  confidence:         0.95,
  notes:              NOTES_R5,
};

function rulesFor(access: AccessClass): RuleSpec[] {
  switch (access) {
    case 'FULL':
    case 'FULL_NO_FP_SILVER':  return [RULE_1, RULE_2, RULE_3];
    case 'FULL_NO_OW_EMERALD': return [RULE_1, RULE_3];
    case 'BIZ_ONLY':           return [RULE_3, RULE_5A];
  }
}

// ── Resolve airport ids ────────────────────────────────────────────────────

const airportIds: Record<string, number> = {};
for (const { iata } of AIRPORTS) {
  const row = db.prepare(`SELECT id FROM airports WHERE iata_code = ?`).get(iata) as { id: number } | undefined;
  if (!row) {
    console.error(`✗ ${iata}: airport row missing — aborting`);
    process.exit(1);
  }
  airportIds[iata] = row.id;
}

// ── Insert loop ────────────────────────────────────────────────────────────

let inserted = 0;
let skipped  = 0;

db.transaction(() => {
  for (const { iata, access } of AIRPORTS) {
    const airportId = airportIds[iata];
    const rules = rulesFor(access);
    console.log(`\n[${iata}] ${access} — ${rules.length} rule(s)`);
    for (const spec of rules) {
      const existing = db.prepare(
        `SELECT id FROM airport_service_rules WHERE airport_id = ? AND service_type = 'fast_track_security' AND notes = ?`,
      ).get(airportId, spec.notes) as { id: number } | undefined;
      if (existing) {
        console.log(`  ↩ ${spec.action.padEnd(5)} ${spec.notes.slice(0, 60)} — exists id=${existing.id}`);
        skipped++;
        continue;
      }
      const result = db.prepare(
        `INSERT INTO airport_service_rules
          (airport_id, service_type, action, provider, min_alliance_tier, carrier_restriction,
           conditions, priority, confidence, valid_from, valid_to, source_url, verified_at,
           tier_semantics, notes)
         VALUES (?, 'fast_track_security', ?, NULL, ?, ?, ?, ?, ?, '2020-01-01', NULL, ?, ?, ?, ?)`,
      ).run(
        airportId,
        spec.action,
        spec.minAllianceTier,
        spec.carrierRestriction ? JSON.stringify(spec.carrierRestriction) : null,
        spec.conditions ? JSON.stringify(spec.conditions) : null,
        spec.priority,
        spec.confidence,
        SOURCE_URL,
        TODAY,
        spec.tierSemantics,
        spec.notes,
      );
      console.log(`  ✓ ${spec.action.padEnd(5)} ${spec.notes.slice(0, 60)} — id=${result.lastInsertRowid}`);
      inserted++;
    }
  }
})();

const byClass = { FULL: 0, FULL_NO_FP_SILVER: 0, FULL_NO_OW_EMERALD: 0, BIZ_ONLY: 0 };
for (const { access } of AIRPORTS) byClass[access]++;
console.log(`\n=== Done ===`);
console.log(`  airports: FULL=${byClass.FULL}  FULL_NO_FP_SILVER=${byClass.FULL_NO_FP_SILVER}  FULL_NO_OW_EMERALD=${byClass.FULL_NO_OW_EMERALD}  BIZ_ONLY=${byClass.BIZ_ONLY}`);
console.log(`  rules:    inserted=${inserted}  skipped=${skipped}`);

db.close();
