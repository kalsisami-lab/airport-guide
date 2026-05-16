// Static lounge database — ground truth for supported airports.
// To add a new airport: append a section below and add the key to LOUNGE_DATABASE.
// Last reviewed: 2026-Q2.

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
// Terminal 1 (Lufthansa / Star Alliance hub):
//   Concourse A — Schengen      — gates A01-A26
//   Concourse B — Non-Schengen  — gates B44-B88
//   Concourse C — Non-Schengen  — gates C101-C116
//   Concourse Z — Schengen      — gates Z01-Z09 (shuttle to Munich)
// Terminal 2 (SkyTeam / Air France hub):
//   Concourse D/E               — gates D01-D26, E01-E22
//
// gateDistances keys: gate letter prefix ('A', 'B', 'C', 'Z', 'D', 'E').
// Users entering FRA gates should include the letter (e.g. "A14", "B72").
//
// Alliance lounge seating at FRA T1:
//   Star Alliance Gold → Lufthansa Senator Lounges (A Schengen / B Non-Schengen)
//   oneworld Sapphire/Emerald → JAL Sakura, Iberia, Qatar Airlines lounges (Concourse B)
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
    id: 'fra-jal-sakura',
    name: 'Japan Airlines Sakura Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse B, Level 2 — Non-Schengen (near Gate B18)',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['JL'],
    openingHours: 'Daily 09:00–15:00 (operates with JL departures)',
    amenities: ['Japanese cuisine', 'Bar', 'Shower rooms', 'WiFi', 'Quiet seating'],
    gateDistances: { 'B': 6, 'C': 11, 'A': 19, 'Z': 23 },
  },
  {
    id: 'fra-iberia-sala-vip',
    name: 'Iberia Sala VIP Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse B, Level 2 — Non-Schengen',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['IB'],
    openingHours: 'Daily 07:00–15:00 (operates with IB departures)',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Work area'],
    gateDistances: { 'B': 7, 'C': 12, 'A': 18, 'Z': 22 },
  },
  {
    id: 'fra-qatar-airways',
    name: 'Qatar Airways Business Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse B, Level 2 — Non-Schengen (near Gate B44)',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['QR'],
    openingHours: 'Daily 08:00–16:00 (operates with QR departures)',
    amenities: ['À la carte dining', 'Premium bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'B': 5, 'C': 10, 'A': 19, 'Z': 23 },
  },
  {
    id: 'fra-asiana-business',
    name: 'Asiana Airlines Business Class Lounge',
    airportCode: 'FRA',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse B, Level 2 — Non-Schengen',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['OZ'],
    openingHours: 'Daily 10:00–16:00 (operates with OZ departures)',
    amenities: ['Korean buffet', 'Bar', 'WiFi', 'Work area'],
    gateDistances: { 'B': 6, 'C': 11, 'A': 18, 'Z': 22 },
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
//   Terminal 1 → A gates (A01-A22)  — oneworld & misc. carriers
//   Terminal 2 → B gates (B01-B34)  — Star Alliance (TG, GA, etc.)
//   Terminal 3 → C gates (C01-C22) and D gates (D01-D22) — SQ main hub
//   Terminal 4 → E gates (E01-E30)  — low-cost and select carriers
//
// gateDistances keys: gate letter prefix ('A', 'B', 'C', 'D', 'E').
//
// Key airline→terminal mapping:
//   T1: BA, CX, QF, MH, JL, AC, UL and other oneworld/independent carriers
//   T2: TG (Thai), GA (Garuda), KE (Korean Air), SQ (select routes)
//   T3: SQ (primary), LH, TK, NH, UA (Star Alliance partners)
//   T4: AK (AirAsia), FD, QG (Citilink)
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
    id: 'sin-british-airways-t1',
    name: 'British Airways Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — near Gates A12-A18',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['BA'],
    openingHours: 'Daily 08:00–18:00 (operates with BA departures)',
    amenities: ['À la carte dining', 'Premium bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'A': 6, 'B': 13, 'C': 18, 'D': 20, 'E': 27 },
  },
  {
    id: 'sin-cathay-skyview-t1',
    name: 'Cathay Pacific The Pier Business Class Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 2 — near Gates A6-A14',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['CX'],
    openingHours: 'Daily 07:00–22:00 (operates with CX departures)',
    amenities: ['Hot buffet', 'Noodle bar', 'Bar', 'Shower rooms', 'WiFi', 'Work stations'],
    gateDistances: { 'A': 5, 'B': 12, 'C': 18, 'D': 20, 'E': 26 },
  },
  {
    id: 'sin-malaysia-golden-t1',
    name: 'Malaysia Airlines Golden Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — near Gates A20-A22',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['MH'],
    openingHours: 'Daily 06:00–22:00 (operates with MH departures)',
    amenities: ['Malaysian cuisine buffet', 'Bar', 'Shower rooms', 'WiFi', 'Prayer room'],
    gateDistances: { 'A': 7, 'B': 13, 'C': 18, 'D': 20, 'E': 26 },
  },
  {
    id: 'sin-thai-royal-orchid-t2',
    name: 'Thai Airways Royal Orchid Lounge',
    airportCode: 'SIN',
    terminal: 'Terminal 2',
    locationDescription: 'Level 3 — near Gates B22-B30',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['TG'],
    openingHours: 'Daily 08:00–16:00 (operates with TG departures)',
    amenities: ['Thai cuisine buffet', 'Bar', 'Shower rooms', 'WiFi', 'Relaxation area'],
    gateDistances: { 'B': 5, 'A': 10, 'C': 13, 'D': 15, 'E': 22 },
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
// LONDON HEATHROW (LHR)
//
// T2 — Star Alliance hub (United, Lufthansa, Swiss, Austrian, Air Canada, etc.)
// T3 — oneworld / misc. (American, Cathay, Virgin Atlantic, etc.)
// T4 — SkyTeam & some BA short-haul (Air France, KLM, Delta, Gulf Air)
// T5 — British Airways + Iberia hub
//
// gateDistances keys: gate letter prefixes as entered by users.
//   T5 gates: A1–A25, B32–B50, C52–C77 → keys 'A', 'B', 'C'
//   T3 gates: D01–D32, E01–E20         → keys 'D', 'E'
//   T2 gates: (numbered)               → key 'T2'
//   T4 gates: (numbered)               → key 'T4'
// ──────────────────────────────────────────────────────────────────────────────
const LHR: StaticLounge[] = [
  {
    id: 'lhr-ba-concorde-room',
    name: 'British Airways Concorde Room',
    airportCode: 'LHR',
    terminal: 'Terminal 5',
    locationDescription: 'Level 5 — exclusive First class lounge, above Galleries First',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['BA', 'IB'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Fine dining à la carte', 'Champagne bar', 'Daybeds & sleep suites', 'Spa treatments', 'Personal host service', 'High-speed WiFi'],
    gateDistances: { 'A': 8, 'B': 12, 'C': 16 },
  },
  {
    id: 'lhr-ba-first-lounge',
    name: 'British Airways Galleries First Lounge',
    airportCode: 'LHR',
    terminal: 'Terminal 5',
    locationDescription: 'Level 4 — adjacent to Concorde Room',
    area: 'international',
    tier: 'premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['BA', 'IB', 'AY'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Hot buffet & grill', 'Cocktail bar', 'Shower suites', 'Spa', 'High-speed WiFi', 'Work area'],
    gateDistances: { 'A': 7, 'B': 11, 'C': 15 },
  },
  {
    id: 'lhr-ba-galleries-club',
    name: 'British Airways Galleries Club Lounge',
    airportCode: 'LHR',
    terminal: 'Terminal 3',
    locationDescription: 'Level 3 — after security, near Gates D',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['BA', 'AA', 'CX', 'QF', 'MH'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'D': 6, 'E': 10, 'A': 20 },
  },
  {
    id: 'lhr-aspire-t5',
    name: 'Aspire Lounge',
    airportCode: 'LHR',
    terminal: 'Terminal 5',
    locationDescription: 'Level 3 — departures area',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { 'A': 9, 'B': 13, 'C': 17 },
  },
  {
    id: 'lhr-no1-lounge-t2',
    name: 'No.1 Traveller Lounge',
    airportCode: 'LHR',
    terminal: 'Terminal 2',
    locationDescription: 'Level 3 — after security',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 04:30–21:30',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { 'T2': 6 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// PARIS CHARLES DE GAULLE (CDG)
//
// Terminal 2 sub-terminals: 2A–2G, 2K, 2M
//   Schengen gates: 2F, 2G, 2K
//   Non-Schengen gates: 2D, 2E (T2E is the main long-haul pier)
// T1: various non-Air France airlines
//
// gateDistances keys: CDG gates entered as e.g. '2F30', '2E12'.
//   First two chars give the hall: '2F', '2G', '2K' (Schengen); '2D', '2E' (non-Schengen).
// ──────────────────────────────────────────────────────────────────────────────
const CDG: StaticLounge[] = [
  {
    id: 'cdg-af-lapremiere',
    name: 'Air France La Première Lounge',
    airportCode: 'CDG',
    terminal: 'Terminal 2E',
    locationDescription: 'Hall M — La Première private suite area (non-Schengen)',
    area: 'non-schengen',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['AF'],
    openingHours: 'Daily 06:00–23:00',
    amenities: ['Private suites', 'Personal chef & à la carte', 'Champagne cellar', 'Spa & shower suites', 'Limousine transfer to gate'],
    gateDistances: { '2E': 6, '2D': 9 },
  },
  {
    id: 'cdg-af-salon-non-schengen',
    name: 'Air France Business Lounge',
    airportCode: 'CDG',
    terminal: 'Terminal 2E',
    locationDescription: 'Hall L/M — Non-Schengen (long-haul departures)',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['AF', 'KL', 'DL', 'KE', 'MU'],
    openingHours: 'Daily 05:30–23:30',
    amenities: ['Hot food buffet', 'Bar & cocktails', 'Shower suites', 'High-speed WiFi', 'Work stations', 'Rest area'],
    gateDistances: { '2E': 5, '2D': 7 },
  },
  {
    id: 'cdg-af-salon-schengen',
    name: 'Air France Business Lounge',
    airportCode: 'CDG',
    terminal: 'Terminal 2F',
    locationDescription: 'Hall K/F — Schengen departures',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['AF', 'KL', 'DL'],
    openingHours: 'Daily 05:30–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { '2F': 4, '2G': 7, '2K': 5 },
  },
  {
    id: 'cdg-aspire-lounge-schengen',
    name: 'Aspire Lounge',
    airportCode: 'CDG',
    terminal: 'Terminal 2F',
    locationDescription: 'Schengen departures level',
    area: 'schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { '2F': 6, '2G': 9, '2K': 7 },
  },
  {
    id: 'cdg-extime-lounge-non-schengen',
    name: 'Extime Lounge',
    airportCode: 'CDG',
    terminal: 'Terminal 2E',
    locationDescription: 'Hall E — Non-Schengen departures',
    area: 'non-schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { '2E': 8, '2D': 6 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// AMSTERDAM SCHIPHOL (AMS)
//
// Single terminal with Schengen and non-Schengen zones.
//   Piers D/F — Schengen (short-haul European routes)
//   Pier E    — Non-Schengen (intercontinental, including KLM long-haul)
//
// gateDistances keys: 'D', 'E', 'F' gate letter prefixes.
// ──────────────────────────────────────────────────────────────────────────────
const AMS: StaticLounge[] = [
  {
    id: 'ams-klm-crown-schengen',
    name: 'KLM Crown Lounge',
    airportCode: 'AMS',
    terminal: 'Main Terminal',
    locationDescription: 'Lounge 51/52 — Schengen, Pier D/F',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['KL', 'AF', 'DL', 'KE'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Delft Blue houses display'],
    gateDistances: { 'D': 5, 'F': 6 },
  },
  {
    id: 'ams-klm-crown-non-schengen',
    name: 'KLM Crown Lounge',
    airportCode: 'AMS',
    terminal: 'Main Terminal',
    locationDescription: 'Lounge 25 — Non-Schengen, Pier E',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['KL', 'AF', 'DL', 'KE'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'E': 6 },
  },
  {
    id: 'ams-aspire-lounge',
    name: 'Aspire Lounge',
    airportCode: 'AMS',
    terminal: 'Main Terminal',
    locationDescription: 'Lounge 4 — Non-Schengen, Pier E',
    area: 'non-schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { 'E': 7 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// MUNICH AIRPORT (MUC)
//
// Terminal 1 (T1): non-Lufthansa carriers; gates A, B, C, D
// Terminal 2 (T2): Lufthansa hub (Star Alliance)
//   Schengen wing:     H gates (H01–H30+)
//   Non-Schengen wing: G gates (G01–G40+)
//
// gateDistances keys: 'H' (Schengen, T2), 'G' (non-Schengen, T2), 'A'/'B'/'C'/'D' (T1).
// ──────────────────────────────────────────────────────────────────────────────
const MUC: StaticLounge[] = [
  {
    id: 'muc-lh-hon-circle',
    name: 'Lufthansa HON Circle Lounge',
    airportCode: 'MUC',
    terminal: 'Terminal 2',
    locationDescription: 'Non-Schengen wing, Level 4 — G concourse (accessible only for HON Circle members)',
    area: 'non-schengen',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['LH', 'LX', 'OS', 'SN'],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Gourmet à la carte', 'Premium bar', 'Shower suites', 'Spa', 'Private seating', 'Butler service'],
    gateDistances: { 'G': 5 },
  },
  {
    id: 'muc-lh-senator-nonschengen',
    name: 'Lufthansa Senator Lounge',
    airportCode: 'MUC',
    terminal: 'Terminal 2',
    locationDescription: 'Non-Schengen wing, Level 3 — G concourse',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['LH', 'LX', 'OS', 'SN', 'EW'],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Hot food station', 'Premium bar', 'Shower suites', 'High-speed WiFi', 'Business centre'],
    gateDistances: { 'G': 6 },
  },
  {
    id: 'muc-lh-senator-schengen',
    name: 'Lufthansa Senator Lounge',
    airportCode: 'MUC',
    terminal: 'Terminal 2',
    locationDescription: 'Schengen wing, Level 3 — H concourse',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['LH', 'LX', 'OS', 'SN'],
    openingHours: 'Daily 05:30–22:30',
    amenities: ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work stations'],
    gateDistances: { 'H': 5 },
  },
  {
    id: 'muc-aspire-t1',
    name: 'Aspire Lounge',
    airportCode: 'MUC',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — after security, near gates B/C',
    area: 'all',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { 'A': 8, 'B': 5, 'C': 5, 'D': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// ZURICH AIRPORT (ZRH)
//
// Airside Center (post-security): both Schengen (Concourse A) and Non-Schengen
//   (Concourses B, C, D, E) accessible from the same security checkpoint.
//
// gateDistances keys: 'A' (Schengen), 'B'/'C'/'D'/'E' (Non-Schengen).
// ──────────────────────────────────────────────────────────────────────────────
const ZRH: StaticLounge[] = [
  {
    id: 'zrh-swiss-first',
    name: 'Swiss First Class Lounge',
    airportCode: 'ZRH',
    terminal: 'Airside Center',
    locationDescription: 'Level 3 — Airside Center, non-Schengen side',
    area: 'non-schengen',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['LX', 'LH', 'OS'],
    openingHours: 'Daily 05:30–22:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa', 'Sleep zone', 'High-speed WiFi'],
    gateDistances: { 'B': 5, 'C': 8, 'D': 10, 'E': 13 },
  },
  {
    id: 'zrh-swiss-business',
    name: 'Swiss Business Lounge',
    airportCode: 'ZRH',
    terminal: 'Airside Center',
    locationDescription: 'Level 3 — Airside Center, non-Schengen side',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['LX', 'LH', 'OS', 'SN'],
    openingHours: 'Daily 05:30–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'B': 5, 'C': 8, 'D': 10, 'E': 13, 'A': 8 },
  },
  {
    id: 'zrh-aspire',
    name: 'Aspire Lounge',
    airportCode: 'ZRH',
    terminal: 'Airside Center',
    locationDescription: 'Level 2 — Airside Center, Schengen side',
    area: 'schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'A': 6 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// MADRID BARAJAS (MAD)
//
// Terminal 4 (T4): Iberia + oneworld + international carriers.
//   T4 main building: Schengen gates A, B.
//   T4S satellite: Non-Schengen gates J (connected via underground shuttle).
//
// gateDistances keys: 'A', 'B' (T4 main Schengen), 'J' (T4S non-Schengen).
// ──────────────────────────────────────────────────────────────────────────────
const MAD: StaticLounge[] = [
  {
    id: 'mad-iberia-vip-t4s',
    name: 'Iberia VIP Lounge Velázquez',
    airportCode: 'MAD',
    terminal: 'Terminal 4S',
    locationDescription: 'Satellite building — Non-Schengen departures',
    area: 'non-schengen',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['IB', 'BA', 'AA', 'QR'],
    openingHours: 'Daily 06:00–22:00',
    amenities: ['Fine dining à la carte', 'Premium bar & wine cellar', 'Shower suites', 'Spa treatments', 'High-speed WiFi'],
    gateDistances: { 'J': 5 },
  },
  {
    id: 'mad-iberia-sala-barajas',
    name: 'Iberia Sala VIP Barajas',
    airportCode: 'MAD',
    terminal: 'Terminal 4',
    locationDescription: 'Level 3 — Schengen departures',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['IB', 'VY', 'I2'],
    openingHours: 'Daily 05:30–22:00',
    amenities: ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'A': 5, 'B': 7 },
  },
  {
    id: 'mad-aspire-t4',
    name: 'Aspire Lounge',
    airportCode: 'MAD',
    terminal: 'Terminal 4',
    locationDescription: 'Level 2 — after security, Schengen side',
    area: 'schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'A': 7, 'B': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// ROME FIUMICINO (FCO)
//
// Terminal 1 (T1): domestic and some Schengen — gates A, B
// Terminal 3 (T3): international (non-Schengen/intercontinental) — gates E, F, G
//
// gateDistances keys: 'A', 'B' (T1/Schengen), 'E', 'F', 'G' (T3/non-Schengen).
// ──────────────────────────────────────────────────────────────────────────────
const FCO: StaticLounge[] = [
  {
    id: 'fco-ita-sala-t3',
    name: 'ITA Airways Sala Lumaca',
    airportCode: 'FCO',
    terminal: 'Terminal 3',
    locationDescription: 'Level 2 — Non-Schengen departures, near Gates E/F',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['AZ', 'AF', 'KL', 'DL'],
    openingHours: 'Daily 06:00–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'E': 5, 'F': 7, 'G': 10 },
  },
  {
    id: 'fco-ita-sala-schengen',
    name: 'ITA Airways Sala Michelangelo',
    airportCode: 'FCO',
    terminal: 'Terminal 1',
    locationDescription: 'Level 2 — Schengen departures, near Gates A/B',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['AZ', 'AF', 'KL'],
    openingHours: 'Daily 05:30–21:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Work area'],
    gateDistances: { 'A': 5, 'B': 7 },
  },
  {
    id: 'fco-aspire-t3',
    name: 'Aspire Lounge',
    airportCode: 'FCO',
    terminal: 'Terminal 3',
    locationDescription: 'Level 2 — Non-Schengen departures',
    area: 'non-schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:30–22:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'E': 7, 'F': 9, 'G': 12 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// ISTANBUL AIRPORT (IST)
//
// Single mega-terminal. International and domestic gates.
//   International departures: gates L, M, N, J, D sections
//   Domestic departures: gates E, F, G sections
//
// gateDistances keys: gate letter prefixes.
// ──────────────────────────────────────────────────────────────────────────────
const IST: StaticLounge[] = [
  {
    id: 'ist-thy-cip-international',
    name: 'Turkish Airlines CIP Lounge',
    airportCode: 'IST',
    terminal: 'Main Terminal',
    locationDescription: 'International departures — Level 3, after passport control',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['TK'],
    openingHours: '24 hours',
    amenities: ['Live cooking stations', 'Gourmet buffet', 'Bar', 'Shower suites', 'Spa & Turkish hammam', 'Children\'s play area', 'Cinema room', 'Golf simulator', 'High-speed WiFi'],
    gateDistances: { 'L': 8, 'M': 10, 'N': 13, 'J': 6, 'D': 7 },
  },
  {
    id: 'ist-thy-business-domestic',
    name: 'Turkish Airlines Business Class Lounge',
    airportCode: 'IST',
    terminal: 'Main Terminal',
    locationDescription: 'Domestic departures — after security',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['TK'],
    openingHours: '24 hours',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'E': 5, 'F': 7, 'G': 9 },
  },
  {
    id: 'ist-primeclass',
    name: 'Primeclass Lounge',
    airportCode: 'IST',
    terminal: 'Main Terminal',
    locationDescription: 'International departures — Level 3',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'L': 10, 'M': 12, 'J': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// STOCKHOLM ARLANDA (ARN)
//
// Terminal 5 (T5): international terminal (SAS main hub).
//   Piers E — Schengen gates (E01–E29)
//   Pier F  — Non-Schengen gates (F01–F20)
//
// gateDistances keys: 'E' (Schengen), 'F' (non-Schengen).
// ──────────────────────────────────────────────────────────────────────────────
const ARN: StaticLounge[] = [
  {
    id: 'arn-sas-gold-lounge',
    name: 'SAS Gold Lounge',
    airportCode: 'ARN',
    terminal: 'Terminal 5',
    locationDescription: 'Level 4 — Non-Schengen, Pier F',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['SK', 'WF', 'DY'],
    openingHours: 'Daily 04:30–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area', 'Quiet zone'],
    gateDistances: { 'F': 5 },
  },
  {
    id: 'arn-sas-business-schengen',
    name: 'SAS Business Lounge',
    airportCode: 'ARN',
    terminal: 'Terminal 5',
    locationDescription: 'Level 3 — Schengen, Pier E',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['SK', 'WF'],
    openingHours: 'Daily 04:30–21:00',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'E': 5 },
  },
  {
    id: 'arn-no1-lounge',
    name: 'No.1 Lounge',
    airportCode: 'ARN',
    terminal: 'Terminal 5',
    locationDescription: 'Level 4 — Non-Schengen, Pier F',
    area: 'non-schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–21:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'F': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// DUBAI INTERNATIONAL (DXB)
//
// Terminal 3: Emirates hub — Concourses A (regional), B, C (long-haul)
// Terminal 1: other airlines — Concourse D
//
// gateDistances keys: 'A', 'B', 'C' (T3), 'D' (T1).
// ──────────────────────────────────────────────────────────────────────────────
const DXB: StaticLounge[] = [
  {
    id: 'dxb-emirates-first-t3',
    name: 'Emirates First Class Lounge',
    airportCode: 'DXB',
    terminal: 'Terminal 3',
    locationDescription: 'Concourse B, Level 3 — accessible from Concourses A, B, C',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['EK'],
    openingHours: '24 hours',
    amenities: ['À la carte dining', 'Premium bar & cigar lounge', 'Spa & shower suites', 'Jacuzzi', 'Sleep pods', 'Private seating areas', 'High-speed WiFi'],
    gateDistances: { 'B': 5, 'A': 10, 'C': 10 },
  },
  {
    id: 'dxb-emirates-business-t3',
    name: 'Emirates Business Class Lounge',
    airportCode: 'DXB',
    terminal: 'Terminal 3',
    locationDescription: 'Concourses A, B, C — multiple lounges per concourse',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['EK'],
    openingHours: '24 hours',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area', 'Relaxation zone'],
    gateDistances: { 'A': 5, 'B': 5, 'C': 5 },
  },
  {
    id: 'dxb-marhaba-t3',
    name: 'Marhaba Lounge',
    airportCode: 'DXB',
    terminal: 'Terminal 3',
    locationDescription: 'Concourse B — after passport control',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms', 'Prayer room'],
    gateDistances: { 'B': 6, 'A': 10, 'C': 10 },
  },
  {
    id: 'dxb-marhaba-t1',
    name: 'Marhaba Lounge',
    airportCode: 'DXB',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse D — after passport control',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'D': 5 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// HAMAD INTERNATIONAL (DOH)
//
// Single terminal with concourses A–E.
//   A/B: Qatar Airways long-haul gates
//   C/D/E: other airlines
//
// gateDistances keys: 'A', 'B', 'C', 'D', 'E'.
// ──────────────────────────────────────────────────────────────────────────────
const DOH: StaticLounge[] = [
  {
    id: 'doh-qa-al-safwa',
    name: 'Qatar Airways Al Safwa First Lounge',
    airportCode: 'DOH',
    terminal: 'Main Terminal',
    locationDescription: 'Level 4 — next to the main terminal atrium (exclusive to First passengers)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['QR'],
    openingHours: '24 hours',
    amenities: ['14 private suites', 'À la carte restaurant', 'Champagne & cigar lounge', 'Spa & shower suites', 'Butler service', 'Library & art gallery'],
    gateDistances: { 'A': 7, 'B': 10 },
  },
  {
    id: 'doh-qa-al-mourjan',
    name: 'Qatar Airways Al Mourjan Business Lounge',
    airportCode: 'DOH',
    terminal: 'Main Terminal',
    locationDescription: 'Level 3 — central atrium area',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['QR', 'AA', 'BA', 'JL', 'CX', 'AY'],
    openingHours: '24 hours',
    amenities: ['À la carte dining', 'Bar', 'Shower suites', 'Sleep area', 'High-speed WiFi', 'Business centre'],
    gateDistances: { 'A': 6, 'B': 9, 'C': 12 },
  },
  {
    id: 'doh-oryx-lounge',
    name: 'Oryx Airport Lounge',
    airportCode: 'DOH',
    terminal: 'Main Terminal',
    locationDescription: 'Level 3 — departures area',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms', 'Prayer room'],
    gateDistances: { 'C': 6, 'D': 7, 'E': 9 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// HONG KONG INTERNATIONAL (HKG)
//
// Terminal 1 with three gate zones:
//   T1W (West):   gates 1–35   — CX/oneworld area (The Wing)
//   T1M (Middle): gates 36–60  — central
//   T1E (East):   gates 61–87  — CX/oneworld area (The Pier), other carriers
//
// gateDistances keys: gate number (numeric prefix matching).
// ──────────────────────────────────────────────────────────────────────────────
const HKG: StaticLounge[] = [
  {
    id: 'hkg-cx-wing-first',
    name: 'Cathay Pacific The Wing First Class Lounge',
    airportCode: 'HKG',
    terminal: 'Terminal 1',
    locationDescription: 'Level 7 — West Hall (near Gates 1–20)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['CX', 'KA'],
    openingHours: '24 hours',
    amenities: ['The Refuge sleep cabins', 'Champagne bar', 'À la carte restaurant', 'Spa & shower suites', 'Cabana pool area', 'High-speed WiFi'],
    gateDistances: { '1': 3, '2': 5, '3': 12, '4': 18, '5': 22, '6': 26 },
  },
  {
    id: 'hkg-cx-wing-business',
    name: 'Cathay Pacific The Wing Business Class Lounge',
    airportCode: 'HKG',
    terminal: 'Terminal 1',
    locationDescription: 'Level 6 — West Hall (near Gates 1–20)',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['CX', 'KA', 'AA', 'BA', 'JL', 'QF', 'MH'],
    openingHours: '24 hours',
    amenities: ['Noodle bar', 'Full buffet', 'Premium bar', 'Shower suites', 'Sleep area', 'WiFi'],
    gateDistances: { '1': 3, '2': 5, '3': 12, '4': 18, '5': 22, '6': 26 },
  },
  {
    id: 'hkg-cx-pier-first',
    name: 'Cathay Pacific The Pier First Class Lounge',
    airportCode: 'HKG',
    terminal: 'Terminal 1',
    locationDescription: 'Level 7 — East Hall (near Gates 60–87)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['CX', 'KA'],
    openingHours: '24 hours',
    amenities: ['The Haven sleep suites', 'À la carte dining', 'Champagne bar', 'Spa', 'Private shower suites'],
    gateDistances: { '6': 5, '7': 3, '8': 5, '5': 12, '4': 18, '3': 24 },
  },
  {
    id: 'hkg-cx-pier-business',
    name: 'Cathay Pacific The Pier Business Class Lounge',
    airportCode: 'HKG',
    terminal: 'Terminal 1',
    locationDescription: 'Level 6 — East Hall (near Gates 60–87)',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['CX', 'KA', 'AA', 'BA', 'JL', 'QF'],
    openingHours: '24 hours',
    amenities: ['Noodle bar', 'Full buffet', 'Bar', 'Shower suites', 'WiFi', 'Work area'],
    gateDistances: { '6': 5, '7': 3, '8': 5, '5': 12, '4': 18, '3': 24 },
  },
  {
    id: 'hkg-plaza-premium',
    name: 'Plaza Premium Lounge',
    airportCode: 'HKG',
    terminal: 'Terminal 1',
    locationDescription: 'Level 6 — Central concourse (multiple locations)',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass', 'amex-centurion'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Children\'s area'],
    gateDistances: { '1': 8, '2': 6, '3': 5, '4': 5, '5': 6, '6': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// TOKYO NARITA (NRT)
//
// Terminal 1 (T1): Star Alliance carriers — ANA main hub; South and North wings.
//   South wing: S gates; North wing: N gates.
// Terminal 2 (T2): JAL and other oneworld/misc. carriers.
//   T2 Satellite: Y gates.
//
// gateDistances keys: 'S', 'N' (T1), 'Y' (T2 satellite), 'T2' (T2 main).
// ──────────────────────────────────────────────────────────────────────────────
const NRT: StaticLounge[] = [
  {
    id: 'nrt-ana-suite-t1',
    name: 'ANA Suite Lounge',
    airportCode: 'NRT',
    terminal: 'Terminal 1',
    locationDescription: 'Level 4 — Main building, South Wing (for Diamond/Platinum Pro & first class)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['NH'],
    openingHours: 'Daily 05:30–23:00 (hours vary with NH departures)',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Sleep area', 'Personal service', 'High-speed WiFi'],
    gateDistances: { 'S': 6, 'N': 10 },
  },
  {
    id: 'nrt-ana-lounge-t1',
    name: 'ANA Lounge',
    airportCode: 'NRT',
    terminal: 'Terminal 1',
    locationDescription: 'Level 4 — South and North wings',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['NH', 'LH', 'UA', 'TG', 'SQ'],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'S': 6, 'N': 10 },
  },
  {
    id: 'nrt-jal-first-t2',
    name: 'JAL First Class Lounge',
    airportCode: 'NRT',
    terminal: 'Terminal 2',
    locationDescription: 'Level 4 — Main building (for JL First class & JMB Diamond on JL flights)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['JL'],
    openingHours: 'Daily 05:30–23:00 (hours vary with JL departures)',
    amenities: ['À la carte restaurant', 'Champagne & sake bar', 'Shower suites', 'Sleep room', 'Traditional Japanese décor', 'WiFi'],
    gateDistances: { 'Y': 5, 'T2': 8 },
  },
  {
    id: 'nrt-jal-sakura-t2',
    name: 'JAL Sakura Lounge',
    airportCode: 'NRT',
    terminal: 'Terminal 2',
    locationDescription: 'Level 3 — Satellite and main building',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['JL', 'AA', 'BA', 'CX', 'QF', 'MH', 'AY'],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area', 'Quiet zone'],
    gateDistances: { 'Y': 5, 'T2': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// SEOUL INCHEON (ICN)
//
// Terminal 1 (T1): Asiana (Star Alliance) and most other carriers.
//   Gates 101–140 (east concourse), 201–270 (west concourse).
// Terminal 2 (T2): Korean Air (SkyTeam) and SkyTeam partners.
//   Gates 230–270.
//
// gateDistances keys: '1' (T1 east, gates 100s), '2' (T1 west or T2, gates 200s+).
// ──────────────────────────────────────────────────────────────────────────────
const ICN: StaticLounge[] = [
  {
    id: 'icn-ke-first-t2',
    name: 'Korean Air First Class Lounge',
    airportCode: 'ICN',
    terminal: 'Terminal 2',
    locationDescription: 'Level 3 — after passport control (SkyTeam Prestige Zone)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['KE'],
    openingHours: '24 hours',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa', 'Private seating areas', 'WiFi'],
    gateDistances: { '2': 5 },
  },
  {
    id: 'icn-ke-morning-calm-t2',
    name: 'Korean Air Morning Calm Lounge',
    airportCode: 'ICN',
    terminal: 'Terminal 2',
    locationDescription: 'Level 3 — after passport control',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['KE', 'AF', 'DL', 'MU'],
    openingHours: '24 hours',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { '2': 6 },
  },
  {
    id: 'icn-oz-first-t1',
    name: 'Asiana First Class Lounge',
    airportCode: 'ICN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — East concourse, after passport control',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['OZ'],
    openingHours: 'Daily 05:30–23:00 (hours vary with OZ departures)',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa', 'WiFi'],
    gateDistances: { '1': 5 },
  },
  {
    id: 'icn-oz-business-t1',
    name: 'Asiana Business Class Lounge',
    airportCode: 'ICN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — East and West concourses',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['OZ', 'LH', 'NH', 'SQ', 'TG'],
    openingHours: '24 hours',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { '1': 5, '2': 6 },
  },
  {
    id: 'icn-smart-lounge-t1',
    name: 'Smart Lounge',
    airportCode: 'ICN',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — after passport control',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { '1': 8, '2': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// BANGKOK SUVARNABHUMI (BKK)
//
// Single main terminal with concourses C–G.
//   Gates: C1–C14, D1–D16, E1–E12, F1–F12, G1–G10.
//
// gateDistances keys: gate letter prefix.
// ──────────────────────────────────────────────────────────────────────────────
const BKK: StaticLounge[] = [
  {
    id: 'bkk-tg-royal-orchid-spa',
    name: 'Thai Airways Royal Orchid Spa',
    airportCode: 'BKK',
    terminal: 'Main Terminal',
    locationDescription: 'Level 3 — Concourse C, near Gate C1 (for Royal First & Royal Silk business passengers)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],
    allowedAlliances: [],
    allowedAirlines: ['TG'],
    openingHours: 'Daily 05:30–23:00 (hours vary with TG departures)',
    amenities: ['Thai massage & spa', 'Fine dining', 'Premium bar', 'Private shower suites', 'Orchid garden design'],
    gateDistances: { 'C': 5, 'D': 9, 'E': 13 },
  },
  {
    id: 'bkk-tg-royal-orchid-lounge',
    name: 'Thai Airways Royal Orchid Lounge',
    airportCode: 'BKK',
    terminal: 'Main Terminal',
    locationDescription: 'Level 3 — Concourses C and D',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['TG', 'NH', 'LH', 'SQ', 'UA'],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['Thai cuisine buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks', 'Relaxation zone'],
    gateDistances: { 'C': 5, 'D': 7, 'E': 11, 'F': 14 },
  },
  {
    id: 'bkk-miracle-lounge',
    name: 'Miracle First Class Lounge',
    airportCode: 'BKK',
    terminal: 'Main Terminal',
    locationDescription: 'Level 3 — near Gate E (multiple locations airside)',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Thai buffet', 'Bar', 'Shower rooms', 'WiFi', 'Prayer room'],
    gateDistances: { 'C': 7, 'D': 6, 'E': 5, 'F': 7, 'G': 10 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// KUALA LUMPUR INTERNATIONAL (KUL)
//
// KLIA Main Terminal: Malaysia Airlines and most international carriers.
// Satellite Building (connected by AEROBUS): MH long-haul gates.
// KLIA2: budget carriers (AirAsia) — separate building.
//
// gateDistances keys: 'C' (main terminal gates), 'G', 'H' (satellite gates).
// ──────────────────────────────────────────────────────────────────────────────
const KUL: StaticLounge[] = [
  {
    id: 'kul-mh-golden-satellite',
    name: 'Malaysia Airlines Golden Lounge',
    airportCode: 'KUL',
    terminal: 'Satellite Building',
    locationDescription: 'Level 5 — Satellite Building (accessible via AEROBUS from main terminal)',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['MH', 'AA', 'BA', 'CX', 'QF', 'JL', 'AY'],
    openingHours: '24 hours',
    amenities: ['Malaysian cuisine buffet', 'Bar', 'Shower suites', 'WiFi', 'Prayer room', 'Work area'],
    gateDistances: { 'G': 5, 'H': 7 },
  },
  {
    id: 'kul-mh-golden-main',
    name: 'Malaysia Airlines Golden Lounge',
    airportCode: 'KUL',
    terminal: 'KLIA Main Terminal',
    locationDescription: 'Level 5 — Main Terminal Concourse C',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['MH'],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Prayer room'],
    gateDistances: { 'C': 5 },
  },
  {
    id: 'kul-plaza-premium',
    name: 'Plaza Premium Lounge',
    airportCode: 'KUL',
    terminal: 'KLIA Main Terminal',
    locationDescription: 'Level 3 — Main Terminal, after immigration',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass', 'amex-centurion'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Children\'s play area', 'Prayer room'],
    gateDistances: { 'C': 7, 'G': 12, 'H': 14 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// BEIJING CAPITAL (PEK)
//
// Terminal 3 (T3): main international terminal — Air China hub.
//   T3B: domestic; T3C: Air China international;
//   T3E: other international carriers; T3F/T3D: select routes.
//
// gateDistances keys: 'T3B', 'T3C', 'T3E' sub-terminal prefixes.
// ──────────────────────────────────────────────────────────────────────────────
const PEK: StaticLounge[] = [
  {
    id: 'pek-air-china-first-t3c',
    name: 'Air China First Class Lounge',
    airportCode: 'PEK',
    terminal: 'Terminal 3',
    locationDescription: 'T3C — Air China international concourse, Level 4',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['CA'],
    openingHours: 'Daily 06:00–23:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Private seating areas', 'High-speed WiFi'],
    gateDistances: { 'T3C': 5 },
  },
  {
    id: 'pek-air-china-phoenix',
    name: 'Air China Phoenix Business Lounge',
    airportCode: 'PEK',
    terminal: 'Terminal 3',
    locationDescription: 'T3C/T3E — multiple locations, Level 4',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['CA', 'NH', 'LH', 'UA', 'TG'],
    openingHours: 'Daily 06:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'T3C': 5, 'T3E': 6 },
  },
  {
    id: 'pek-t3-vip-lounge',
    name: 'T3 VIP Lounge',
    airportCode: 'PEK',
    terminal: 'Terminal 3',
    locationDescription: 'T3E — international gates area, Level 3',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 06:00–23:00',
    amenities: ['Buffet', 'Bar', 'WiFi'],
    gateDistances: { 'T3E': 6, 'T3C': 10 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// SHANGHAI PUDONG (PVG)
//
// Terminal 1 (T1): Star Alliance / misc. carriers.
// Terminal 2 (T2): China Eastern (SkyTeam) hub.
//   Both terminals have international and domestic zones.
//
// gateDistances keys: 'T1', 'T2' terminal prefixes.
// ──────────────────────────────────────────────────────────────────────────────
const PVG: StaticLounge[] = [
  {
    id: 'pvg-mf-business-t2',
    name: 'China Eastern Business Class Lounge',
    airportCode: 'PVG',
    terminal: 'Terminal 2',
    locationDescription: 'Level 4 — International departures',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['MU', 'FM', 'AF', 'KL', 'DL', 'KE'],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['Chinese & Western buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'T2': 5 },
  },
  {
    id: 'pvg-skyteam-t2',
    name: 'SkyTeam Lounge',
    airportCode: 'PVG',
    terminal: 'Terminal 2',
    locationDescription: 'Level 4 — International departures',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: [],
    openingHours: 'Daily 06:00–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { 'T2': 6 },
  },
  {
    id: 'pvg-no80-lounge-t1',
    name: 'No. 80 Lounge',
    airportCode: 'PVG',
    terminal: 'Terminal 1',
    locationDescription: 'Level 4 — International departures area',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'T1': 6 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// SYDNEY KINGSFORD SMITH (SYD)
//
// Terminal 1 (T1): International terminal — all international departures.
//   Gates 1–60 across multiple concourses.
//
// gateDistances keys: numeric gate range prefixes.
// ──────────────────────────────────────────────────────────────────────────────
const SYD: StaticLounge[] = [
  {
    id: 'syd-qf-first-t1',
    name: 'Qantas First Lounge',
    airportCode: 'SYD',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — after customs, near Gates 20–30',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['QF'],
    openingHours: 'Daily 05:00–23:00 (hours vary with QF departures)',
    amenities: ['À la carte dining by Neil Perry', 'Premium bar & cellar', 'Shower suites', 'Spa treatments', 'Rest pods', 'High-speed WiFi'],
    gateDistances: { '2': 7, '3': 5, '4': 9, '5': 13 },
  },
  {
    id: 'syd-qf-business-t1',
    name: 'Qantas International Business Lounge',
    airportCode: 'SYD',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — after customs, near Gates 20–30',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['QF', 'AA', 'BA', 'CX', 'JL', 'MH', 'AY'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area', 'Children\'s zone'],
    gateDistances: { '2': 7, '3': 5, '4': 9, '5': 13 },
  },
  {
    id: 'syd-plaza-premium-t1',
    name: 'Plaza Premium Lounge',
    airportCode: 'SYD',
    terminal: 'Terminal 1',
    locationDescription: 'Level 3 — International departures',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { '1': 6, '2': 6, '3': 7, '4': 10, '5': 14 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// NEW YORK JFK
//
// T1: Air France, Korean Air, Japan Airlines, Lufthansa.
// T4: Delta, Air France/KLM (selected), Emirates, JetBlue, others.
// T5: JetBlue (domestic only).
// T7: British Airways.
// T8: American Airlines.
//
// gateDistances keys: terminal-level prefixes ('T1', 'T4', 'T7', 'T8').
// ──────────────────────────────────────────────────────────────────────────────
const JFK: StaticLounge[] = [
  {
    id: 'jfk-delta-one-lounge-t4',
    name: 'Delta One Lounge',
    airportCode: 'JFK',
    terminal: 'Terminal 4',
    locationDescription: 'Level 3 — exclusive Delta One (business class) passengers only',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['DL'],
    openingHours: 'Daily 06:00–23:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa treatments', 'Private seating', 'High-speed WiFi'],
    gateDistances: { 'T4': 6 },
  },
  {
    id: 'jfk-delta-sky-club-t4',
    name: 'Delta Sky Club',
    airportCode: 'JFK',
    terminal: 'Terminal 4',
    locationDescription: 'Level 3 — after security, near Gates B/C',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['DL', 'AF', 'KL', 'KE'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'T4': 8 },
  },
  {
    id: 'jfk-aa-flagship-t8',
    name: 'American Airlines Flagship Lounge',
    airportCode: 'JFK',
    terminal: 'Terminal 8',
    locationDescription: 'Level 3 — after security (for First/Business & oneworld Emerald)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AA', 'BA', 'QR', 'JL', 'CX', 'AY'],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa', 'High-speed WiFi'],
    gateDistances: { 'T8': 5 },
  },
  {
    id: 'jfk-aa-admirals-t8',
    name: 'American Airlines Admirals Club',
    airportCode: 'JFK',
    terminal: 'Terminal 8',
    locationDescription: 'Level 3 — after security',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AA', 'BA', 'QR', 'JL', 'CX', 'AY'],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'T8': 7 },
  },
  {
    id: 'jfk-united-club-t7',
    name: 'United Club',
    airportCode: 'JFK',
    terminal: 'Terminal 7',
    locationDescription: 'Level 4 — after security',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['UA', 'LH', 'NH', 'SQ', 'TG'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'T7': 6 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// LOS ANGELES (LAX)
//
// TBIT (Tom Bradley International Terminal): most international carriers.
// T4: American Airlines domestic + international.
// T7: United Airlines.
// T2/T3: Delta domestic/international.
//
// gateDistances keys: 'T4', 'T7', 'TB' (TBIT).
// ──────────────────────────────────────────────────────────────────────────────
const LAX: StaticLounge[] = [
  {
    id: 'lax-united-polaris-t7',
    name: 'United Polaris Lounge',
    airportCode: 'LAX',
    terminal: 'Terminal 7',
    locationDescription: 'Level 3 — Mezzanine (accessible via escalator from security)',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['UA', 'LH', 'NH', 'SQ'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa', 'Sleep area', 'High-speed WiFi'],
    gateDistances: { 'T7': 6 },
  },
  {
    id: 'lax-united-club-t7',
    name: 'United Club',
    airportCode: 'LAX',
    terminal: 'Terminal 7',
    locationDescription: 'Level 3 — after security',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['UA', 'LH', 'NH', 'AC'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'T7': 8 },
  },
  {
    id: 'lax-aa-flagship-t4',
    name: 'American Airlines Flagship Lounge',
    airportCode: 'LAX',
    terminal: 'Terminal 4',
    locationDescription: 'Level 3 — after security',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AA', 'BA', 'QR', 'JL', 'CX'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'WiFi'],
    gateDistances: { 'T4': 6 },
  },
  {
    id: 'lax-delta-sky-club-tbit',
    name: 'Delta Sky Club',
    airportCode: 'LAX',
    terminal: 'Tom Bradley International Terminal',
    locationDescription: 'Level 3 — after security, near Gates 101–121',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['DL', 'AF', 'KL', 'KE'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'TB': 6 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// CHICAGO O'HARE (ORD)
//
// T1: United Airlines hub — Concourses B and C.
// T2: Domestic carriers.
// T3: American Airlines + some international — Concourses G, H, K.
// T5: International Terminal — Concourse M.
//
// gateDistances keys: 'B', 'C' (T1 United), 'G', 'H', 'K' (T3 AA), 'M' (T5 intl).
// ──────────────────────────────────────────────────────────────────────────────
const ORD: StaticLounge[] = [
  {
    id: 'ord-united-polaris-t1',
    name: 'United Polaris Lounge',
    airportCode: 'ORD',
    terminal: 'Terminal 1',
    locationDescription: 'Concourse C — Level 3, after security',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['UA', 'LH', 'NH', 'SQ', 'TG', 'AC'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa', 'Sleep area', 'High-speed WiFi'],
    gateDistances: { 'C': 5, 'B': 10 },
  },
  {
    id: 'ord-united-club-t1',
    name: 'United Club',
    airportCode: 'ORD',
    terminal: 'Terminal 1',
    locationDescription: 'Concourses B and C — multiple locations',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['UA', 'LH', 'NH', 'AC'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'B': 5, 'C': 5 },
  },
  {
    id: 'ord-aa-flagship-t3',
    name: 'American Airlines Flagship Lounge',
    airportCode: 'ORD',
    terminal: 'Terminal 3',
    locationDescription: 'Concourse H — Level 3, after security',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AA', 'BA', 'IB', 'JL', 'CX', 'QR', 'AY'],
    openingHours: 'Daily 05:30–22:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'WiFi'],
    gateDistances: { 'H': 5, 'G': 8, 'K': 8 },
  },
  {
    id: 'ord-aa-admirals-t3',
    name: 'American Airlines Admirals Club',
    airportCode: 'ORD',
    terminal: 'Terminal 3',
    locationDescription: 'Concourses G, H, K — multiple locations',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AA', 'BA', 'IB', 'JL', 'QR', 'AY'],
    openingHours: 'Daily 05:30–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'G': 5, 'H': 5, 'K': 5 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// MIAMI INTERNATIONAL (MIA)
//
// Single D-ring terminal with North and South wings.
//   North terminal: American Airlines gates D30–D60 (international), E, F
//   Central: Concourse H, J (other international carriers)
//
// gateDistances keys: gate letter prefix.
// ──────────────────────────────────────────────────────────────────────────────
const MIA: StaticLounge[] = [
  {
    id: 'mia-aa-flagship',
    name: 'American Airlines Flagship Lounge',
    airportCode: 'MIA',
    terminal: 'North Terminal',
    locationDescription: 'Concourse D — Level 3, International departures',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AA', 'BA', 'IB', 'JL', 'CX', 'QR', 'AY'],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'WiFi'],
    gateDistances: { 'D': 5, 'E': 9 },
  },
  {
    id: 'mia-aa-admirals',
    name: 'American Airlines Admirals Club',
    airportCode: 'MIA',
    terminal: 'North Terminal',
    locationDescription: 'Concourses D, E — multiple locations',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['AA', 'BA', 'IB', 'JL', 'QR', 'AY'],
    openingHours: 'Daily 05:30–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    gateDistances: { 'D': 7, 'E': 7 },
  },
  {
    id: 'mia-centurion',
    name: 'Centurion Lounge',
    airportCode: 'MIA',
    terminal: 'North Terminal',
    locationDescription: 'Concourse D — Level 2, after security',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['amex-centurion'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 06:00–22:00',
    amenities: ['Hot food stations', 'Bar', 'Shower rooms', 'WiFi', 'Spa treatments'],
    gateDistances: { 'D': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// TORONTO PEARSON (YYZ)
//
// Terminal 1 (T1): Air Canada hub — Pier D (domestic), Pier F (US transborder), Pier E/G (international).
// Terminal 3 (T3): Domestic and some international carriers.
//
// gateDistances keys: 'D', 'E', 'F', 'G' (T1 pier prefixes).
// ──────────────────────────────────────────────────────────────────────────────
const YYZ: StaticLounge[] = [
  {
    id: 'yyz-ac-maple-leaf-intl',
    name: 'Air Canada Maple Leaf Lounge',
    airportCode: 'YYZ',
    terminal: 'Terminal 1',
    locationDescription: 'Pier E/G — International departures, Level 3',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['AC', 'LH', 'UA', 'NH', 'SQ', 'TG'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area', 'Regional art installations'],
    gateDistances: { 'E': 5, 'G': 6 },
  },
  {
    id: 'yyz-ac-maple-leaf-dom',
    name: 'Air Canada Maple Leaf Lounge',
    airportCode: 'YYZ',
    terminal: 'Terminal 1',
    locationDescription: 'Pier D — Domestic departures, Level 3',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['AC'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { 'D': 5 },
  },
  {
    id: 'yyz-plaza-premium',
    name: 'Plaza Premium Lounge',
    airportCode: 'YYZ',
    terminal: 'Terminal 1',
    locationDescription: 'Pier E — International departures, Level 3',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi'],
    gateDistances: { 'E': 7, 'G': 8 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// SAN FRANCISCO (SFO)
//
// International Terminal (AIT): most international carriers — gates A1-A12, G91-G102.
// Terminal 3: United Airlines — Concourses E and F.
// Terminal 2: American, Alaska, Delta.
//
// gateDistances keys: 'A', 'G' (International), 'E', 'F' (United T3).
// ──────────────────────────────────────────────────────────────────────────────
const SFO: StaticLounge[] = [
  {
    id: 'sfo-united-polaris-t3',
    name: 'United Polaris Lounge',
    airportCode: 'SFO',
    terminal: 'Terminal 3',
    locationDescription: 'Concourse E — Level 3, after security',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['UA', 'LH', 'NH', 'SQ', 'AC'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa', 'Sleep area', 'High-speed WiFi'],
    gateDistances: { 'E': 5, 'F': 8, 'A': 14, 'G': 14 },
  },
  {
    id: 'sfo-united-club-t3',
    name: 'United Club',
    airportCode: 'SFO',
    terminal: 'Terminal 3',
    locationDescription: 'Concourses E and F — multiple locations',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['UA', 'LH', 'NH', 'AC'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'E': 6, 'F': 8 },
  },
  {
    id: 'sfo-af-klm-intl',
    name: 'Air France / KLM Lounge',
    airportCode: 'SFO',
    terminal: 'International Terminal',
    locationDescription: 'Boarding Area A — Level 3, after security',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    allowedAlliances: ['skyteam'],
    allowedAirlines: ['AF', 'KL', 'DL', 'KE'],
    openingHours: 'Daily 06:00–22:00 (hours vary with AF/KL departures)',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'A': 5, 'G': 12 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// SÃO PAULO GUARULHOS (GRU)
//
// Terminal 3 (T3): international and LATAM main hub.
//
// gateDistances keys: 'T3' terminal prefix.
// ──────────────────────────────────────────────────────────────────────────────
const GRU: StaticLounge[] = [
  {
    id: 'gru-latam-vip-t3',
    name: 'LATAM VIP Lounge',
    airportCode: 'GRU',
    terminal: 'Terminal 3',
    locationDescription: 'Level 3 — International departures (oneworld members & LATAM top tier)',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    allowedAlliances: ['oneworld'],
    allowedAirlines: ['LA', 'BA', 'AA', 'IB', 'QR', 'JL', 'CX'],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Brazilian & international buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'T3': 5 },
  },
  {
    id: 'gru-aspire-t3',
    name: 'Aspire Lounge',
    airportCode: 'GRU',
    terminal: 'Terminal 3',
    locationDescription: 'Level 3 — International departures',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–23:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'T3': 7 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// JOHANNESBURG O.R. TAMBO (JNB)
//
// Terminal A (domestic) and Terminal B (international).
//
// gateDistances keys: 'A' (domestic), 'B' (international).
// ──────────────────────────────────────────────────────────────────────────────
const JNB: StaticLounge[] = [
  {
    id: 'jnb-saa-lounge',
    name: 'South African Airways Lounge',
    airportCode: 'JNB',
    terminal: 'Terminal B',
    locationDescription: 'Level 2 — International departures',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    allowedAlliances: ['star-alliance'],
    allowedAirlines: ['SA', 'LH', 'UA', 'SQ', 'NH'],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateDistances: { 'B': 6 },
  },
  {
    id: 'jnb-bidvest-premier',
    name: 'Bidvest Premier Lounge',
    airportCode: 'JNB',
    terminal: 'Terminal B',
    locationDescription: 'Level 2 — International and Domestic departures (multiple locations)',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    allowedAlliances: [],
    allowedAirlines: [],
    openingHours: 'Daily 05:00–22:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Shower rooms'],
    gateDistances: { 'A': 6, 'B': 5 },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Master database — add new airports here
// ──────────────────────────────────────────────────────────────────────────────
export const LOUNGE_DATABASE: Readonly<Record<string, StaticLounge[]>> = {
  HEL,
  FRA,
  SIN,
  LHR,
  CDG,
  AMS,
  MUC,
  ZRH,
  MAD,
  FCO,
  IST,
  ARN,
  DXB,
  DOH,
  HKG,
  NRT,
  ICN,
  BKK,
  KUL,
  PEK,
  PVG,
  SYD,
  JFK,
  LAX,
  ORD,
  MIA,
  YYZ,
  SFO,
  GRU,
  JNB,
};
