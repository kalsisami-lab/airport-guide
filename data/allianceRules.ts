// Alliance membership and lounge-access rules.
// Update when alliance changes are announced (typically months in advance).
// Last verified: 2025-Q1. Source: official alliance member directories.

export type Alliance = 'oneworld' | 'star-alliance' | 'skyteam';
export type LoungeClass = 'first' | 'business' | 'standard';

/**
 * IATA 2-letter operating carrier code → global alliance.
 * Only full members listed; affiliate/regional partners excluded unless they
 * grant full reciprocal lounge access.
 */
export const CARRIER_ALLIANCE: Readonly<Record<string, Alliance>> = {
  // ── oneworld ─────────────────────────────────────────────────────────
  AA: 'oneworld',  // American Airlines
  AS: 'oneworld',  // Alaska Airlines
  AT: 'oneworld',  // Royal Air Maroc
  AY: 'oneworld',  // Finnair
  BA: 'oneworld',  // British Airways
  CX: 'oneworld',  // Cathay Pacific
  IB: 'oneworld',  // Iberia
  JL: 'oneworld',  // Japan Airlines
  MH: 'oneworld',  // Malaysia Airlines
  QF: 'oneworld',  // Qantas
  QR: 'oneworld',  // Qatar Airways
  RJ: 'oneworld',  // Royal Jordanian
  UL: 'oneworld',  // SriLankan Airlines
  // ── Star Alliance ────────────────────────────────────────────────────
  AC: 'star-alliance',  // Air Canada
  AI: 'star-alliance',  // Air India
  AV: 'star-alliance',  // Avianca
  BR: 'star-alliance',  // EVA Air
  CA: 'star-alliance',  // Air China
  CM: 'star-alliance',  // Copa Airlines
  ET: 'star-alliance',  // Ethiopian Airlines
  LH: 'star-alliance',  // Lufthansa
  LO: 'star-alliance',  // LOT Polish Airlines
  LX: 'star-alliance',  // Swiss International Air Lines
  MS: 'star-alliance',  // EgyptAir
  NH: 'star-alliance',  // All Nippon Airways (ANA)
  NZ: 'star-alliance',  // Air New Zealand
  OS: 'star-alliance',  // Austrian Airlines
  OU: 'star-alliance',  // Croatia Airlines
  OZ: 'star-alliance',  // Asiana Airlines
  SA: 'star-alliance',  // South African Airways
  SK: 'star-alliance',  // Scandinavian Airlines
  SN: 'star-alliance',  // Brussels Airlines
  SQ: 'star-alliance',  // Singapore Airlines
  TG: 'star-alliance',  // Thai Airways International
  TK: 'star-alliance',  // Turkish Airlines
  TP: 'star-alliance',  // TAP Air Portugal
  UA: 'star-alliance',  // United Airlines
  ZH: 'star-alliance',  // Shenzhen Airlines
  // ── SkyTeam ──────────────────────────────────────────────────────────
  AF: 'skyteam',  // Air France
  AM: 'skyteam',  // Aeroméxico
  AZ: 'skyteam',  // ITA Airways (formerly Alitalia)
  CZ: 'skyteam',  // China Southern
  DL: 'skyteam',  // Delta Air Lines
  GA: 'skyteam',  // Garuda Indonesia
  KE: 'skyteam',  // Korean Air
  KL: 'skyteam',  // KLM Royal Dutch Airlines
  ME: 'skyteam',  // Middle East Airlines
  MF: 'skyteam',  // Xiamen Airlines
  MU: 'skyteam',  // China Eastern Airlines
  OK: 'skyteam',  // Czech Airlines
  RO: 'skyteam',  // TAROM
  UX: 'skyteam',  // Air Europa
  VN: 'skyteam',  // Vietnam Airlines
};

/**
 * Maps internal status access-method IDs (from data/airlineStatuses.ts)
 * to the corresponding alliance and tier used by the lounge filter.
 * Add new entries here when new statuses are added to airlineStatuses.ts.
 */
export const STATUS_ALLIANCE_TIER: Readonly<Record<string, { alliance: Alliance; tier: string }>> = {
  'oneworld-emerald':      { alliance: 'oneworld',      tier: 'emerald' },
  'oneworld-sapphire':     { alliance: 'oneworld',      tier: 'sapphire' },
  'finnair-plus-platinum': { alliance: 'oneworld',      tier: 'emerald' },  // = OW Emerald
  'finnair-plus-gold':     { alliance: 'oneworld',      tier: 'sapphire' }, // = OW Sapphire
  'star-alliance-gold':    { alliance: 'star-alliance', tier: 'gold' },
  'skyteam-elite-plus':    { alliance: 'skyteam',       tier: 'elite-plus' },
};

/**
 * Which lounge classes each alliance tier unlocks.
 * 'first'    = First Class / Flagship / Premium First lounges
 * 'business' = Business Class / Senator / Gold lounges
 *
 * Alliance status does NOT grant access to 'standard' lounges via tier alone —
 * those require a card network (Priority Pass, etc.) or paid entry.
 */
export const ALLIANCE_TIER_ACCESS: Readonly<Record<Alliance, Record<string, LoungeClass[]>>> = {
  oneworld: {
    emerald:  ['first', 'business'],  // OW Emerald: First + Business lounges
    sapphire: ['business'],           // OW Sapphire: Business lounges only
    ruby:     [],                     // OW Ruby: no reciprocal lounge access
  },
  'star-alliance': {
    gold:   ['business'],   // SA Gold: Business / Senator lounges
    silver: [],             // SA Silver: no lounge access
  },
  skyteam: {
    'elite-plus': ['business'],  // ST Elite Plus: Business lounges
    elite:        [],            // ST Elite: no lounge access
  },
};
