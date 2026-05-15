import type { CreditCard } from '@/data/creditCards';
import type { AirlineStatus, Alliance } from '@/data/airlineStatuses';
import type { Lounge, LoungeArea } from '@/data/lounges';

export type EligibleLounge = {
  lounge: Lounge;
  reason: string;
  areaMatch: boolean;
  accessMethod: string;
};

export type AllianceAccess = {
  alliance: 'oneworld' | 'star-alliance' | 'skyteam';
  tier: string;
  message: string;
};

export type EligibilityResult = {
  hasFastTrack: boolean;
  fastTrackReasons: string[];
  eligibleLounges: EligibleLounge[];
  bestLounge: EligibleLounge | null;
  allianceAccess: AllianceAccess | null;
};

const TIER_ORDER: Record<string, number> = {
  'ultra-premium': 0,
  premium: 1,
  restaurant: 2,
  standard: 3,
};

// Canonical airline code → alliance mapping for cross-alliance validation
export const AIRLINE_ALLIANCE: Partial<Record<string, Alliance>> = {
  // oneworld
  AY: 'oneworld', BA: 'oneworld', IB: 'oneworld', QF: 'oneworld',
  AA: 'oneworld', CX: 'oneworld', MH: 'oneworld', JL: 'oneworld',
  RJ: 'oneworld', S7: 'oneworld', UL: 'oneworld', LA: 'oneworld',
  // Star Alliance
  LH: 'star-alliance', UA: 'star-alliance', CA: 'star-alliance',
  AC: 'star-alliance', NH: 'star-alliance', SQ: 'star-alliance',
  TK: 'star-alliance', LX: 'star-alliance', OS: 'star-alliance',
  SK: 'star-alliance', TP: 'star-alliance', OZ: 'star-alliance',
  ET: 'star-alliance', EW: 'star-alliance', A3: 'star-alliance',
  ZH: 'star-alliance',
  // SkyTeam
  AF: 'skyteam', KL: 'skyteam', DL: 'skyteam', MU: 'skyteam',
  KE: 'skyteam', SU: 'skyteam', ME: 'skyteam', AZ: 'skyteam',
  AM: 'skyteam', AR: 'skyteam', OK: 'skyteam',
  GA: 'skyteam', RO: 'skyteam', VN: 'skyteam',
};

export function checkEligibility(
  card: CreditCard | null,
  status: AirlineStatus | null,
  lounges: Lounge[],
  area: LoungeArea | 'both' = 'both',
  airportName?: string,
  airlineCode?: string,
): EligibilityResult {
  const fastTrackReasons: string[] = [];
  const eligibleMap = new Map<string, { reason: string; accessMethod: string }>();

  const at = airportName ? ` at ${airportName}` : '';
  if (status?.fastTrack) {
    fastTrackReasons.push(`${status.name} includes Fast Track${at}`);
  }
  if (card?.fastTrack) {
    fastTrackReasons.push(`${card.name} includes Fast Track${at}`);
  }

  // Access via airline status
  if (status) {
    for (const lounge of lounges) {
      if (eligibleMap.has(lounge.id)) continue;
      const method = lounge.accessMethods.find((m) => status.accessMethods.includes(m));
      if (method) {
        eligibleMap.set(lounge.id, { reason: status.name, accessMethod: method });
      }
    }
  }

  // Access via credit card
  const label: Record<string, string> = {
    'priority-pass': 'Priority Pass',
    'lounge-key': 'LoungeKey',
    'dragon-pass': 'DragonPass',
    'amex-platinum': 'complimentary dining credit',
    'op-card': 'OP card access',
  };

  if (card) {
    for (const lounge of lounges) {
      if (eligibleMap.has(lounge.id)) continue;
      const match = card.loungeAccess.find((m) => lounge.accessMethods.includes(m));
      if (match) {
        eligibleMap.set(lounge.id, { reason: `${card.name} – ${label[match]}`, accessMethod: match });
      }
    }
  }

  // Exclusive card-specific perks sort above generic network memberships
  const EXCLUSIVE_METHODS = new Set(['amex-platinum', 'op-card']);

  const eligibleLounges: EligibleLounge[] = Array.from(eligibleMap.entries())
    .map(([id, { reason, accessMethod }]) => {
      const lounge = lounges.find((l) => l.id === id)!;
      const areaMatch = area === 'both' || lounge.area === area || !!lounge.alwaysAccessible;
      return { lounge, reason, areaMatch, accessMethod };
    })
    .filter((e) => e.lounge != null)
    .sort((a, b) => {
      if (a.areaMatch !== b.areaMatch) return a.areaMatch ? -1 : 1;
      const aExclusive = EXCLUSIVE_METHODS.has(a.accessMethod);
      const bExclusive = EXCLUSIVE_METHODS.has(b.accessMethod);
      if (aExclusive !== bExclusive) return aExclusive ? -1 : 1;
      return (TIER_ORDER[a.lounge.tier] ?? 99) - (TIER_ORDER[b.lounge.tier] ?? 99);
    });

  // Alliance access message: only show when the flight's airline belongs to the
  // same alliance as the user's status. If no airline code is known we show it
  // generically (user may or may not be flying an alliance carrier).
  let allianceAccess: AllianceAccess | null = null;
  if (status && status.loungeTier !== 'none' && status.alliance !== 'none') {
    const flightAlliance = airlineCode ? AIRLINE_ALLIANCE[airlineCode] : undefined;
    const allianceMatches = !airlineCode || !flightAlliance || flightAlliance === status.alliance;

    if (allianceMatches) {
      if (status.alliance === 'oneworld') {
        const tier = status.loungeTier === 'platinum' ? 'Emerald' : 'Sapphire';
        allianceAccess = {
          alliance: 'oneworld',
          tier,
          message: `As a oneworld ${tier} member, you have access to oneworld partner lounges worldwide. Look for British Airways, Iberia, American Airlines, Cathay Pacific, or other oneworld carrier lounges at this airport.`,
        };
      } else if (status.alliance === 'star-alliance') {
        allianceAccess = {
          alliance: 'star-alliance',
          tier: 'Gold',
          message: 'As a Star Alliance Gold member, you have access to Star Alliance partner lounges. Look for Lufthansa, United Airlines, Singapore Airlines, ANA, or other Star Alliance carrier lounges at this airport.',
        };
      } else if (status.alliance === 'skyteam') {
        allianceAccess = {
          alliance: 'skyteam',
          tier: 'Elite Plus',
          message: 'As a SkyTeam Elite Plus member, you have access to SkyTeam partner lounges. Look for Air France, KLM, Delta Air Lines, Korean Air, or other SkyTeam carrier lounges at this airport.',
        };
      }
    }
  }

  return {
    hasFastTrack: fastTrackReasons.length > 0,
    fastTrackReasons,
    eligibleLounges,
    bestLounge: eligibleLounges[0] ?? null,
    allianceAccess,
  };
}

// Extract IATA airline code from flight number (e.g. "AY123" → "AY")
export function parseAirlineCode(flightNumber: string): string {
  return flightNumber.replace(/\d+.*$/, '').toUpperCase().trim();
}

const AIRLINE_NAMES: Record<string, string> = {
  // oneworld
  AY: 'Finnair',
  BA: 'British Airways',
  IB: 'Iberia',
  QF: 'Qantas',
  AA: 'American Airlines',
  CX: 'Cathay Pacific',
  MH: 'Malaysia Airlines',
  JL: 'Japan Airlines',
  RJ: 'Royal Jordanian',
  S7: 'S7 Airlines',
  UL: 'SriLankan Airlines',
  LA: 'LATAM Airlines',
  // Star Alliance
  LH: 'Lufthansa',
  UA: 'United Airlines',
  CA: 'Air China',
  AC: 'Air Canada',
  NH: 'ANA',
  SQ: 'Singapore Airlines',
  TK: 'Turkish Airlines',
  LX: 'Swiss',
  OS: 'Austrian Airlines',
  SK: 'SAS',
  TP: 'TAP Air Portugal',
  OZ: 'Asiana Airlines',
  ET: 'Ethiopian Airlines',
  EW: 'Eurowings',
  A3: 'Aegean Airlines',
  // SkyTeam
  AF: 'Air France',
  KL: 'KLM',
  DL: 'Delta Air Lines',
  MU: 'China Eastern',
  KE: 'Korean Air',
  SU: 'Aeroflot',
  ME: 'Middle East Airlines',
  AZ: 'ITA Airways',
  AM: 'Aeromexico',
  AR: 'Aerolíneas Argentinas',
  OK: 'Czech Airlines',
  GA: 'Garuda Indonesia',
  RO: 'TAROM',
  VN: 'Vietnam Airlines',
  // Independent / LCC
  EK: 'Emirates',
  QR: 'Qatar Airways',
  FR: 'Ryanair',
  W6: 'Wizz Air',
  U2: 'easyJet',
  WF: 'Widerøe',
};

export function getAirlineName(code: string): string | null {
  return AIRLINE_NAMES[code.toUpperCase()] ?? null;
}
