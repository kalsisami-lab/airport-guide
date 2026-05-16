/**
 * Flight direction heuristic for hub-centric carriers.
 *
 * Convention: ODD flight number = outbound from hub; EVEN = inbound to hub.
 * This is a widely-used IATA numbering convention followed by most major carriers.
 * It is a heuristic — use for pre-filling and validation, not as authoritative truth.
 */

export interface DirectionHint {
  /** IATA code of the carrier's primary hub */
  hubIata: string;
  /** true = departing FROM the hub; false = arriving AT the hub */
  isOutbound: boolean;
}

// Hub-centric carriers that follow the odd/even numbering convention
const HUB_CARRIERS: Record<string, string> = {
  AY: 'HEL',  // Finnair — Helsinki
  BA: 'LHR',  // British Airways — Heathrow
  EK: 'DXB',  // Emirates — Dubai
  QR: 'DOH',  // Qatar Airways — Doha
  EY: 'AUH',  // Etihad — Abu Dhabi
  SQ: 'SIN',  // Singapore Airlines — Changi
  CX: 'HKG',  // Cathay Pacific — Hong Kong
  TK: 'IST',  // Turkish Airlines — Istanbul
  LH: 'FRA',  // Lufthansa — Frankfurt
  AF: 'CDG',  // Air France — Paris CDG
  KL: 'AMS',  // KLM — Amsterdam
  SK: 'ARN',  // SAS — Stockholm
  IB: 'MAD',  // Iberia — Madrid
  OS: 'VIE',  // Austrian — Vienna
  QF: 'SYD',  // Qantas — Sydney
  JL: 'NRT',  // Japan Airlines — Tokyo Narita
  NH: 'NRT',  // ANA — Tokyo Narita
};

/**
 * Returns a direction hint for a hub-centric carrier based on flight number parity.
 *
 * Example:
 *   AY1411 → { hubIata: 'HEL', isOutbound: true }   // odd → departs HEL
 *   AY1412 → { hubIata: 'HEL', isOutbound: false }  // even → arrives HEL
 *
 * Returns null for unknown carriers or malformed flight numbers.
 */
export function getFlightDirectionHint(flightNumber: string): DirectionHint | null {
  const match = flightNumber.trim().toUpperCase().match(/^([A-Z]{2})(\d+)$/);
  if (!match) return null;

  const [, code, digits] = match;
  const hubIata = HUB_CARRIERS[code];
  if (!hubIata) return null;

  const num = parseInt(digits, 10);
  if (isNaN(num)) return null;

  return { hubIata, isOutbound: num % 2 === 1 };
}
