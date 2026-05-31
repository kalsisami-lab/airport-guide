/**
 * Flight direction heuristic for hub-centric carriers.
 *
 * Three numbering schemes used across major carriers:
 *   hub_finnair   — odd = outbound from hub (most carriers)
 *   hub_lufthansa — even = outbound from hub (LH, BA)
 *   compass_us    — no parity convention (AA, DL, UA)
 *
 * This is a heuristic — use for pre-filling and validation, not as authoritative truth.
 * The Aviationstack integration in useFlightLookup is the authoritative source.
 */

type DirectionScheme = 'hub_finnair' | 'hub_lufthansa' | 'compass_us';

interface AirlineConvention {
  hub: string;
  scheme: DirectionScheme;
}

const AIRLINE_DIRECTION_CONVENTIONS: Record<string, AirlineConvention> = {
  // hub_finnair: odd = outbound from hub
  AY: { hub: 'HEL', scheme: 'hub_finnair' },
  EK: { hub: 'DXB', scheme: 'hub_finnair' },
  QR: { hub: 'DOH', scheme: 'hub_finnair' },
  EY: { hub: 'AUH', scheme: 'hub_finnair' },
  SQ: { hub: 'SIN', scheme: 'hub_finnair' },
  CX: { hub: 'HKG', scheme: 'hub_finnair' },
  TK: { hub: 'IST', scheme: 'hub_finnair' },
  AF: { hub: 'CDG', scheme: 'hub_finnair' },
  KL: { hub: 'AMS', scheme: 'hub_finnair' },
  SK: { hub: 'ARN', scheme: 'hub_finnair' },
  IB: { hub: 'MAD', scheme: 'hub_finnair' },
  OS: { hub: 'VIE', scheme: 'hub_finnair' },
  QF: { hub: 'SYD', scheme: 'hub_finnair' },
  JL: { hub: 'NRT', scheme: 'hub_finnair' },
  NH: { hub: 'NRT', scheme: 'hub_finnair' },
  // hub_lufthansa: even = outbound from hub
  LH: { hub: 'FRA', scheme: 'hub_lufthansa' },
  BA: { hub: 'LHR', scheme: 'hub_lufthansa' },
  // compass_us: no hub parity convention
  AA: { hub: 'DFW', scheme: 'compass_us' },
  DL: { hub: 'ATL', scheme: 'compass_us' },
  UA: { hub: 'ORD', scheme: 'compass_us' },
};

export type DirectionGuess =
  | { confidence: 'high'; direction: 'outbound' | 'inbound'; from: string; basis: string }
  | { confidence: 'low';  direction: 'unknown';               basis: string };

export type FlightClass = 'flagship' | 'regular' | 'codeshare' | 'ferry_charter' | 'unknown';

function parseFlightParts(flightNumber: string): { code: string; num: number } | null {
  const match = flightNumber.trim().toUpperCase().match(/^([A-Z]{2})(\d+)$/);
  if (!match) return null;
  const num = parseInt(match[2], 10);
  if (isNaN(num)) return null;
  return { code: match[1], num };
}

export function getFlightDirectionGuess(flightNumber: string): DirectionGuess {
  const parsed = parseFlightParts(flightNumber);
  if (!parsed) return { confidence: 'low', direction: 'unknown', basis: 'not_parseable' };

  const { code, num } = parsed;
  const convention = AIRLINE_DIRECTION_CONVENTIONS[code];
  if (!convention) return { confidence: 'low', direction: 'unknown', basis: 'unknown_carrier' };

  if (convention.scheme === 'compass_us') {
    return { confidence: 'low', direction: 'unknown', basis: 'compass_us_no_parity' };
  }

  const isOdd      = num % 2 === 1;
  const isOutbound = convention.scheme === 'hub_finnair' ? isOdd : !isOdd;

  return {
    confidence: 'high',
    direction:  isOutbound ? 'outbound' : 'inbound',
    from:       convention.hub,
    basis:      convention.scheme,
  };
}

export function classifyFlightNumber(flightNumber: string): FlightClass {
  const parsed = parseFlightParts(flightNumber);
  if (!parsed) return 'unknown';

  const { num } = parsed;
  if (num >= 1    && num <= 99)   return 'flagship';
  if (num >= 100  && num <= 2999) return 'regular';
  if (num >= 3000 && num <= 8999) return 'codeshare';
  if (num >= 9000 && num <= 9999) return 'ferry_charter';
  return 'unknown';
}
