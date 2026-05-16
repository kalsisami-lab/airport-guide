// Static lounge database — ground truth for supported airports.
// To add a new airport: append a section below and add the key to LOUNGE_DATABASE.
// Last reviewed: 2025-Q2.

import type { LoungeNetwork, LoungeClass, AILoungeTier } from '@/lib/aiLounge';

export type StaticLounge = {
  id: string;
  name: string;
  airportCode: string;              // IATA airport code
  terminal: string;                 // e.g. "Terminal 1", "Main Terminal"
  locationDescription: string;      // human-readable detail, e.g. "Concourse B, Level 3"
  area: 'schengen' | 'non-schengen' | 'international' | 'all';
  tier: AILoungeTier;
  loungeClass: LoungeClass;
  // Access networks in priority order (best/most prestigious first).
  // The first network the user qualifies for is used as the access method.
  networks: LoungeNetwork[];
  // Descriptive alliance/airline lists (informational, used for display)
  allowedAlliances: string[];       // e.g. ['oneworld', 'star-alliance']
  allowedAirlines: string[];        // IATA carrier codes with direct/own access
  openingHours: string;
  amenities: string[];
  // Gate prefix → walk time in minutes. Longest matching prefix wins.
  // For letter-prefixed gates (FRA, SIN): use 'A', 'B', 'C', etc.
  // For numeric gates (HEL): use leading digit(s), e.g. '3' matches gates 30-39.
  gateDistances: Record<string, number>;
};

// ──────────────────────────────────────────────────────────────────────────────
// HELSINKI-VANTAA (HEL)
//
// Gate layout (pier code / zone / gate range):
//   Pier B — Schengen     — 11-19
//   Pier C — Schengen     — 20-29
//   Pier D — Non-Schengen — 30-49
//   Pier E — Non-Schengen — 50-60
//
// gateDistances keys: first digit of gate number.
//   '1' → gates 11-19 (Pier B, Schengen)
//   '2' → gates 20-29 (Pier C, Schengen)
//   '3' → gates 30-39 (Pier D, Non-Schengen)
//   '4' → gates 40-49 (Pier D, Non-Schengen, far end)
//   '5' → gates 50-60 (Pier E, Non-Schengen)
//   '36'→ exact gate 36 (Platinum Wing is right next door)
// ──────────────────────────────────────────────────────────────────────────────
const HEL: StaticLounge[] = [
  {
    id: 'hel-finnair-platinum-wing',
    name: 'Finnair Platinum Wing',
    airportCode: 'HEL',
    terminal: 'Main Terminal',
    locationDescription: 'Non-Schengen, Level 3 — between Gates 30 and 36',
    area: 'non-schengen',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld'],          // Emerald only — Sapphire gets Finnair Lounge
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AY'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['À la carte dining', 'Premium bar & sommelier', 'Spa & sauna', 'Shower suites', 'Private seating areas', 'High-speed WiFi'],
    gateDistances: { '36': 2, '3': 6, '4': 11, '5': 16 },
  },
  {
    id: 'hel-finnair-lounge-nonschengen',
    name: 'Finnair Lounge',
    airportCode: 'HEL',
    terminal: 'Main Terminal',
    locationDescription: 'Non-Schengen, Level 3 — near Gate 30',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'priority-pass'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AY'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Hot & cold buffet', 'Bar & cocktails', 'Shower suites', 'High-speed WiFi', 'Work desks', 'Children\'s area'],
    gateDistances: { '3': 5, '4': 9, '5': 13 },
  },
  {
    id: 'hel-finnair-lounge-schengen',
    name: 'Finnair Lounge',
    airportCode: 'HEL',
    terminal: 'Main Terminal',
    locationDescription: 'Schengen, Level 2 — Pier C, near Gates 22–26',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'priority-pass'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AY'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi', 'Quiet zone'],
    gateDistances: { '2': 4, '1': 7 },
  },
  {
    id: 'hel-airport-lounge-schengen',
    name: 'Helsinki Airport Lounge',
    airportCode: 'HEL',
    terminal: 'Main Terminal',
    locationDescription: 'Schengen, Level 2 — Pier B, near Gate 21',
    area: 'schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–21:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'TV lounge', 'Newspapers & magazines'],
    gateDistances: { '1': 5, '2': 4 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// FRANKFURT AM MAIN (FRA)
//
// Terminal 1 (Star Alliance / Lufthansa hub):
//   Concourse A — Schengen      — gates A01-A26 (strip letter → 1-26)
//   Concourse B — Non-Schengen  — gates B44-B88 (strip letter → 44-88)
//   Concourse C — Non-Schengen  — gates C101-C116 (strip letter → 101-116)
//   Concourse Z — Schengen      — gates Z01-Z09 (shuttle to Munich)
// Terminal 2 (SkyTeam / Air France hub):
//   Concourse D/E               — gates D01-D26, E01-E22
//
// gateDistances keys: gate letter prefix ('A', 'B', 'C', 'Z', 'D', 'E').
// Users entering FRA gates should include the letter (e.g. "A14", "B72").
// ──────────────────────────────────────────────────────────────────────────────
const FRA: StaticLounge[] = [
  {
    id: 'fra-lh-first-class-lounge',
    name: 'Lufthansa First Class Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse B, Level 4 — Non-Schengen (accessible via dedicated lift)',
    area: 'non-schengen',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],   // Miles&More HON Circle or LH/LX/OS first-class ticket only; NOT Star Alliance Gold
    allowedAlliances: [],
    allowedAirlines: ['LH', 'LX', 'OS', 'SN'],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Gourmet à la carte', 'Cigar lounge', 'Spa & massages', 'Private suites', 'Personal butler', 'Chauffeur service'],
    gateDistances: { 'B': 5, 'C': 12, 'A': 20 },
  },
  {
    id: 'fra-lh-senator-nonschengen',
    name: 'Lufthansa Senator Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse B, Level 3 — Non-Schengen',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['LH', 'LX', 'OS', 'SN', 'EW'],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Hot food station', 'Premium bar', 'Shower suites', 'High-speed WiFi', 'Business centre', 'Quiet zone'],
    gateDistances: { 'B': 5, 'C': 10, 'A': 18, 'Z': 22, 'D': 30, 'E': 32 },
  },
  {
    id: 'fra-lh-senator-schengen',
    name: 'Lufthansa Senator Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse A, Level 2 — Schengen',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['LH', 'LX', 'OS', 'SN'],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work stations'],
    gateDistances: { 'A': 5, 'Z': 9, 'B': 18, 'C': 25 },
  },
  {
    id: 'fra-lh-business-nonschengen',
    name: 'Lufthansa Business Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse B, Level 2 — Non-Schengen',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    // Star Alliance Gold holders are directed to the Senator Lounge — not this one.
    // This lounge serves LH/LX/OS Business class passengers without Senator card.
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['LH', 'LX', 'OS', 'SN'],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'B': 6, 'C': 11, 'A': 20 },
  },
  {
    id: 'fra-lh-business-schengen',
    name: 'Lufthansa Business Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse A, Level 1 — Schengen',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['LH', 'LX', 'OS', 'SN'],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'A': 5, 'Z': 8 },
  },
  {
    id: 'fra-airfrance-t2',
    name: 'Air France Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 2',
    locationDescription: 'Terminal 2, Concourse D — near Gates D01-D26',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['AF', 'KL', 'DL', 'KE', 'MU', 'CZ'],
    openingHours: 'Daily 06:00–22:00',
    amenities: ['Hot buffet', 'Bar', 'WiFi', 'Business desks', 'Shower rooms'],
    gateDistances: { 'D': 5, 'E': 8, 'Z': 15, 'A': 25 },
  },
  {
    id: 'fra-primeclass-schengen',
    name: 'Primeclass Business Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse A, Level 1 — Schengen (above security)',
    area: 'schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–22:30',
    amenities: ['Buffet', 'Bar', 'Showers', 'WiFi', 'Workstations'],
    gateDistances: { 'A': 6, 'Z': 10 },
  },
  {
    id: 'fra-aspire-t2',
    name: 'Aspire Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 2',
    locationDescription: 'Terminal 2, Level 2 — near Gates E',
    area: 'non-schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 06:00–22:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Showers'],
    gateDistances: { 'E': 5, 'D': 8, 'Z': 18 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// SINGAPORE CHANGI (SIN)
//
// All flights are international — no Schengen-equivalent zone split.
// Terminal / gate mapping:
//   Terminal 1 → A gates (A01-A22)
//   Terminal 2 → B gates (B01-B34)
//   Terminal 3 → C gates (C01-C22) and D gates (D01-D22)
//   Terminal 4 → E gates (E01-E30)
//
// gateDistances keys: gate letter prefix ('A', 'B', 'C', 'D', 'E').
// ──────────────────────────────────────────────────────────────────────────────
const SIN: StaticLounge[] = [
  {
    id: 'sin-silverKris-first-t3',
    name: 'Singapore Airlines SilverKris First Class Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 3',
    locationDescription: 'Level 3 — adjacent to The Private Room, near Gates C/D',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    // Accessible to SA Gold when flying SQ in First/Suites; or KrisFlyer Elite Gold
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['SQ'],
    openingHours: '24 hours',
    amenities: ['Fine dining à la carte', 'Champagne & spirits bar', 'Private shower suites', 'Sleep zone', 'Personal butler'],
    gateDistances: { 'C': 5, 'D': 7, 'B': 14, 'A': 20, 'E': 28 },
  },
  {
    id: 'sin-silverKris-business-t3',
    name: 'Singapore Airlines SilverKris Business Class Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 3',
    locationDescription: 'Level 3 — near Gates C/D',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['SQ', 'MI'],
    openingHours: '24 hours',
    amenities: ['Noodle bar', 'Full buffet', 'Premium bar', 'Shower suites', 'Sleep area', 'WiFi'],
    gateDistances: { 'C': 5, 'D': 7, 'B': 14, 'A': 20, 'E': 28 },
  },
  {
    id: 'sin-silverKris-business-t2',
    name: 'Singapore Airlines SilverKris Business Class Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 2',
    locationDescription: 'Level 3 — near Gates B',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['SQ', 'MI'],
    openingHours: '24 hours',
    amenities: ['Noodle bar', 'Full buffet', 'Bar', 'Shower suites', 'WiFi'],
    gateDistances: { 'B': 4, 'A': 10, 'C': 12, 'D': 14, 'E': 22 },
  },
  {
    id: 'sin-silverKris-business-t1',
    name: 'Singapore Airlines SilverKris Business Class Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — near Gates A',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['SQ', 'MI'],
    openingHours: '24 hours',
    amenities: ['Noodle bar', 'Full buffet', 'Bar', 'Shower suites', 'WiFi'],
    gateDistances: { 'A': 5, 'B': 11, 'C': 17, 'D': 19, 'E': 25 },
  },
  {
    id: 'sin-private-room-t3',
    name: 'Singapore Airlines The Private Room',
    airportCode: 'SIN',
    terminal: 'Terminal 3',
    locationDescription: 'Level 3 — adjacent to SilverKris First Class Lounge',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],   // SQ Suites/First class and KrisFlyer PPS Club only
    allowedAlliances: [],
    allowedAirlines: ['SQ'],
    openingHours: '24 hours',
    amenities: ['Private dining rooms', 'Chef on demand', 'Champagne bar', 'Spa treatments', 'Limousine transfer'],
    gateDistances: { 'C': 5, 'D': 7 },
  },
  {
    id: 'sin-qantas-t1',
    name: 'Qantas International Business Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — near Gates A10-A22',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['QF', 'AA', 'BA', 'AY', 'CX', 'JL'],
    openingHours: 'Daily 06:00–23:00 (hours vary with QF departures)',
    amenities: ['À la carte dining', 'Bar', 'Shower rooms', 'WiFi', 'Work area', 'Children\'s zone'],
    gateDistances: { 'A': 5, 'B': 12, 'C': 18, 'D': 20, 'E': 26 },
  },
  {
    id: 'sin-sats-premier-t3',
    name: 'SATS Premier Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 3',
    locationDescription: 'Level 2 — near Gates C14-C22',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Prayer room', 'Kids\' area'],
    gateDistances: { 'C': 6, 'D': 8, 'B': 15, 'A': 22, 'E': 28 },
  },
  {
    id: 'sin-sats-premier-t2',
    name: 'SATS Premier Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 2',
    locationDescription: 'Level 3 — near Gates B8-B20',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Children\'s area'],
    gateDistances: { 'B': 5, 'A': 12, 'C': 14, 'D': 16, 'E': 22 },
  },
  {
    id: 'sin-sats-premier-t1',
    name: 'SATS Premier Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — near Gates A6-A16',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { 'A': 5, 'B': 12, 'C': 18, 'D': 20 },
  },
  {
    id: 'sin-plaza-premium-t4',
    name: 'Plaza Premium Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 4',
    locationDescription: 'Level 2 — near Gates E01-E12',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'amex-centurion'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Children\'s play area'],
    gateDistances: { 'E': 5, 'C': 22, 'D': 24 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Master database — add new airports here
// ──────────────────────────────────────────────────────────────────────────────
export const LOUNGE_DATABASE: Readonly<Record<string, StaticLounge[]>> = {
  HEL,
  FRA,
  SIN,
};
