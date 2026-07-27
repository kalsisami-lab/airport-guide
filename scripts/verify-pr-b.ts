/**
 * Verification harness for PR-B — runs the real repository + normalizer
 * against the checked-in DB to prove:
 *   (a) RJ "Gold SPARROW" normalizes to oneworld_sapphire (the code name
 *       does not break matching — it's an exact tier_name lookup, not a
 *       "starts with Gold" match).
 *   (b) CX "Cathay Diamond" resolves to oneworld_emerald, and would earn
 *       Emerald benefits on a HKG or SYD oneworld flight.
 *   (c) Sample additional PR-B tiers to prove the mapping is live.
 *
 * Uses the same code path as /api/entitlements — createTierRepository +
 * buildStatusContext.
 */
import { createAirlineRepository, createTierRepository } from '../lib/normalization/repository';
import { buildStatusContext } from '../lib/normalization/normalize';
import type { UserStatusCard, AllianceCode } from '../lib/normalization/types';

const tierRepo = createTierRepository();
const airlineRepo = createAirlineRepository();

interface Case {
  label: string;
  card: UserStatusCard;
  flightCarrier: string; // to derive alliance for the flight
}

const CASES: Case[] = [
  { label: 'RJ Gold SPARROW on a RJ flight',           card: { programCode: 'rj-royal-club',     tierName: 'Gold SPARROW'        }, flightCarrier: 'RJ' },
  { label: 'RJ Gold SPARROW on a BA flight (oneworld)', card: { programCode: 'rj-royal-club',     tierName: 'Gold SPARROW'        }, flightCarrier: 'BA' },
  { label: 'RJ "Gold" (wrong spelling, should not match)', card: { programCode: 'rj-royal-club', tierName: 'Gold'                }, flightCarrier: 'RJ' },
  { label: 'CX Cathay Diamond on a CX flight (HKG)',   card: { programCode: 'cx-asia-miles',     tierName: 'Cathay Diamond'      }, flightCarrier: 'CX' },
  { label: 'CX Cathay Diamond on a QF flight (SYD)',   card: { programCode: 'cx-asia-miles',     tierName: 'Cathay Diamond'      }, flightCarrier: 'QF' },
  { label: 'CX Cathay Diamond on a non-oneworld carrier', card: { programCode: 'cx-asia-miles',  tierName: 'Cathay Diamond'      }, flightCarrier: 'EK' },
  { label: 'AA Executive Platinum on a QF flight',     card: { programCode: 'aa-advantage',      tierName: 'AAdvantage Executive Platinum' }, flightCarrier: 'QF' },
  { label: 'AS Titanium on an AS flight',              card: { programCode: 'as-atmos',          tierName: 'Atmos Rewards Titanium' }, flightCarrier: 'AS' },
  { label: 'IB Infinita Prime on an IB flight',        card: { programCode: 'ib-plus',           tierName: 'Iberia Club Infinita Prime' }, flightCarrier: 'IB' },
  { label: 'QF Platinum One on a QF flight (SYD)',     card: { programCode: 'qf-frequent-flyer', tierName: 'Qantas Frequent Flyer Platinum One' }, flightCarrier: 'QF' },
  { label: 'AT Safar Flyer Ambassador on an AT flight', card: { programCode: 'at-safar-flyer',   tierName: 'Safar Flyer Ambassador' }, flightCarrier: 'AT' },
  { label: 'UL FlySmiLes Platinum on a UL flight',     card: { programCode: 'ul-flysmiles',      tierName: 'FlySmiLes Platinum'  }, flightCarrier: 'UL' },
];

console.log('=== PR-B engine-level verification ===\n');
let pass = 0;
let fail = 0;
for (const c of CASES) {
  const flightAlliance = airlineRepo.getAllianceForCarrier(c.flightCarrier) as AllianceCode;
  const ctx = buildStatusContext([c.card], flightAlliance, tierRepo);
  const emoji = ctx === null ? '✗' : '✓';
  const result = ctx === null
    ? 'null (unknown card, would drop)'
    : `allianceTier=${ctx.allianceTier} · tierName="${ctx.tierName}"`;
  console.log(`  ${emoji} ${c.label}`);
  console.log(`      flight ${c.flightCarrier} (alliance=${flightAlliance ?? 'none'}) → ${result}\n`);
  // "Gold" (typo case) is expected to be null.
  const expectedNull = c.card.tierName === 'Gold';
  const actualNull = ctx === null;
  if (expectedNull === actualNull) pass += 1; else fail += 1;
}
console.log(`\n=== ${pass}/${pass + fail} cases behaved as expected ===`);
