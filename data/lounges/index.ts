// Alliance-isolated lounge router.
// Callers ask for lounges by airport + user context; this module returns only
// the candidate set that can possibly match — preventing cross-alliance leakage.

export type { StaticLounge } from './types';
export { ONEWORLD_LOUNGES } from './oneworld';
export { STAR_ALLIANCE_LOUNGES } from './starAlliance';
export { SKYTEAM_LOUNGES } from './skyteam';
export { INDEPENDENT_LOUNGES } from './independent';
export { AMEX_LOUNGES } from '../amexData';
export { PRIORITY_PASS_LOUNGES } from '../priorityPassData';

import type { StaticLounge } from './types';
import { ONEWORLD_LOUNGES } from './oneworld';
import { STAR_ALLIANCE_LOUNGES } from './starAlliance';
import { SKYTEAM_LOUNGES } from './skyteam';
import { INDEPENDENT_LOUNGES } from './independent';
import { AMEX_LOUNGES } from '../amexData';
import { PRIORITY_PASS_LOUNGES } from '../priorityPassData';
import { CARRIER_ALLIANCE, STATUS_ALLIANCE_TIER } from '@/data/allianceRules';
import type { Alliance } from '@/data/allianceRules';

// ─── Alliance detection ────────────────────────────────────────────────────────

function detectAlliance(
  operatingCarrierCode: string | null,
  statusAccessMethods: string[],
): Alliance | null {
  if (operatingCarrierCode) {
    const a = CARRIER_ALLIANCE[operatingCarrierCode.toUpperCase()];
    if (a) return a;
  }
  for (const m of statusAccessMethods) {
    const entry = STATUS_ALLIANCE_TIER[m];
    if (entry) return entry.alliance;
  }
  return null;
}

// ─── Router ────────────────────────────────────────────────────────────────────

const PP_NETWORKS = new Set(['priority-pass', 'lounge-key', 'dragon-pass']);

interface RouteParams {
  airportIata: string;
  operatingCarrierCode: string | null;
  statusAccessMethods: string[];
  cardNetworks: string[];
}

/**
 * Returns the lounge candidate set for a given user context.
 *
 * Alliance datasets are mutually exclusive: a oneworld user never sees
 * Star Alliance or SkyTeam lounges, and vice versa.
 * Card-access lounges (Amex, Priority Pass) are always searched independently
 * and merged on top of any alliance results.
 */
export function getLoungeCandidates({
  airportIata,
  operatingCarrierCode,
  statusAccessMethods,
  cardNetworks,
}: RouteParams): StaticLounge[] {
  const iata = airportIata.toUpperCase();
  const alliance = detectAlliance(operatingCarrierCode, statusAccessMethods);

  const pool: StaticLounge[] = [];

  // Alliance lounges — strictly isolated
  if (alliance === 'oneworld') {
    pool.push(...(ONEWORLD_LOUNGES[iata] ?? []));
  } else if (alliance === 'star-alliance') {
    pool.push(...(STAR_ALLIANCE_LOUNGES[iata] ?? []));
  } else if (alliance === 'skyteam') {
    pool.push(...(SKYTEAM_LOUNGES[iata] ?? []));
  }

  // Card lounges — searched simultaneously, independent of alliance
  if (cardNetworks.includes('amex-centurion')) {
    pool.push(...(AMEX_LOUNGES[iata] ?? []));
  }
  if (cardNetworks.some((n) => PP_NETWORKS.has(n))) {
    pool.push(...(PRIORITY_PASS_LOUNGES[iata] ?? []));
  }

  // Airline-own (independent) lounges are always candidates;
  // loungeFilter's airline-own case enforces carrier matching.
  pool.push(...(INDEPENDENT_LOUNGES[iata] ?? []));

  // Deduplicate by id (e.g. Plaza Premium appears in both Amex + PP pools)
  const seen = new Set<string>();
  return pool.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
}

// ─── Legacy flat database ──────────────────────────────────────────────────────
// Combines all datasets into a single Record for code that needs the full list.

function mergeForAirport(iata: string): StaticLounge[] {
  const seen = new Set<string>();
  const all = [
    ...(ONEWORLD_LOUNGES[iata] ?? []),
    ...(STAR_ALLIANCE_LOUNGES[iata] ?? []),
    ...(SKYTEAM_LOUNGES[iata] ?? []),
    ...(AMEX_LOUNGES[iata] ?? []),
    ...(PRIORITY_PASS_LOUNGES[iata] ?? []),
    ...(INDEPENDENT_LOUNGES[iata] ?? []),
  ];
  return all.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
}

const SUPPORTED_IATAS = new Set([
  ...Object.keys(ONEWORLD_LOUNGES),
  ...Object.keys(STAR_ALLIANCE_LOUNGES),
  ...Object.keys(SKYTEAM_LOUNGES),
  ...Object.keys(AMEX_LOUNGES),
  ...Object.keys(PRIORITY_PASS_LOUNGES),
  ...Object.keys(INDEPENDENT_LOUNGES),
]);

export const LOUNGE_DATABASE: Readonly<Record<string, StaticLounge[]>> = Object.fromEntries(
  [...SUPPORTED_IATAS].map((iata) => [iata, mergeForAirport(iata)]),
);
