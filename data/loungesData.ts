// Static lounge database — ground truth for supported airports.
// Add new airports here; the lounge API falls back to Gemini for unlisted ones.
// Last reviewed: 2025-Q2.

import type { LoungeNetwork, LoungeClass, AILoungeTier } from '@/lib/aiLounge';

export type GateProximity = {
  prefix: string;   // gate string prefix to match (e.g. "A", "3", "B1")
  minutes: number;
};

export type StaticLounge = {
  id: string;
  name: string;
  location: string;
  // 'schengen' | 'non-schengen' | 'international' | 'all'
  // 'all' means no zone split (e.g. SIN), 'international' = non-EU international airports
  area: 'schengen' | 'non-schengen' | 'international' | 'all';
  tier: AILoungeTier;
  loungeClass: LoungeClass;
  // Access networks in priority order — the first one the user qualifies for is shown
  networks: LoungeNetwork[];
  hours: string;
  amenities: string[];
  // Gate proximity: prefix matched longest-first, e.g. "36" beats "3"
  gateProximity?: GateProximity[];
};

// ──────────────────────────────────────────────────────────────────────────────
// HELSINKI-VANTAA (HEL)
// Gate layout: B pier (Schengen) 11–19, C pier (Schengen) 20–29,
//              D pier (Non-Schengen) 30–49, E pier (Non-Schengen) 50–60
// ──────────────────────────────────────────────────────────────────────────────
const HEL_LOUNGES: StaticLounge[] = [
  {
    id: 'hel-finnair-platinum-wing',
    name: 'Finnair Platinum Wing',
    location: 'Non-Schengen, Level 3 — between Gates 30 and 36',
    area: 'non-schengen',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['oneworld'],  // Emerald only (Sapphire gets Finnair Lounge, not Platinum Wing)
    hours: 'Daily 05:00–22:00',
    amenities: ['À la carte dining', 'Premium bar', 'Spa & sauna', 'Shower suites', 'Private seating'],
    gateProximity: [
      { prefix: '36', minutes: 2 },
      { prefix: '3',  minutes: 6 },
      { prefix: '4',  minutes: 10 },
      { prefix: '5',  minutes: 14 },
    ],
  },
  {
    id: 'hel-finnair-lounge-nonschengen',
    name: 'Finnair Lounge',
    location: 'Non-Schengen, Level 3 — near Gate 30',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'priority-pass'],
    hours: 'Daily 05:00–22:00',
    amenities: ['Hot & cold buffet', 'Bar & cocktails', 'Shower suites', 'High-speed WiFi', 'Work desks'],
    gateProximity: [
      { prefix: '3',  minutes: 5 },
      { prefix: '4',  minutes: 8 },
      { prefix: '5',  minutes: 12 },
    ],
  },
  {
    id: 'hel-finnair-lounge-schengen',
    name: 'Finnair Lounge',
    location: 'Schengen, Level 2 — C pier, near Gates 22–26',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'priority-pass'],
    hours: 'Daily 05:00–22:00',
    amenities: ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi', 'Quiet zone'],
    gateProximity: [
      { prefix: '2',  minutes: 4 },
      { prefix: '1',  minutes: 7 },
    ],
  },
  {
    id: 'hel-airport-lounge-schengen',
    name: 'Helsinki Airport Lounge',
    location: 'Schengen, Level 2 — B pier, near Gate 21',
    area: 'schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    hours: 'Daily 05:00–21:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'TV lounge'],
    gateProximity: [
      { prefix: '1',  minutes: 5 },
      { prefix: '2',  minutes: 4 },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// FRANKFURT AM MAIN (FRA)
// Gate layout (numeric part after stripping letter prefix):
//   A pier (Schengen)     1–49    → "A14" → num 14 → Pier A
//   B pier (Non-Schengen) 50–99   → "B72" → num 72 → Pier B
//   C pier (Non-Schengen) 100–149 → "C112"→ num 112 → Pier C
//   Z pier (Schengen, T2) 200–260 → "Z201"→ num 201 → Pier Z
// Lounge proximity uses letter-prefix matching (e.g. "A", "B").
// ──────────────────────────────────────────────────────────────────────────────
const FRA_LOUNGES: StaticLounge[] = [
  {
    id: 'fra-lh-senator-nonschengen',
    name: 'Lufthansa Senator Lounge',
    location: 'Terminal 1, Concourse B — Non-Schengen, Level 3',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    hours: 'Daily 05:30–22:00',
    amenities: ['Hot food station', 'Premium bar', 'Shower suites', 'Fast WiFi', 'Business area'],
    gateProximity: [
      { prefix: 'B', minutes: 5 },
      { prefix: 'C', minutes: 10 },
      { prefix: 'A', minutes: 15 },
    ],
  },
  {
    id: 'fra-lh-senator-schengen',
    name: 'Lufthansa Senator Lounge',
    location: 'Terminal 1, Concourse A — Schengen, Level 2',
    area: 'schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    hours: 'Daily 05:30–22:00',
    amenities: ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work stations'],
    gateProximity: [
      { prefix: 'A', minutes: 5 },
      { prefix: 'Z', minutes: 10 },
      { prefix: 'B', minutes: 18 },
    ],
  },
  {
    id: 'fra-lh-first-class',
    name: 'Lufthansa First Class Lounge',
    location: 'Terminal 1, Concourse B — Non-Schengen, Level 3',
    area: 'non-schengen',
    tier: 'ultra-premium',
    loungeClass: 'first',
    // Only for LH/Miles&More HON Circle or first-class ticket — not accessible via SA Gold
    networks: ['airline-own'],
    hours: 'Daily 05:30–22:00',
    amenities: ['Gourmet à la carte', 'Cigar lounge', 'Spa & massages', 'Private suites', 'Personal butlers'],
    gateProximity: [
      { prefix: 'B', minutes: 5 },
      { prefix: 'C', minutes: 10 },
    ],
  },
  {
    id: 'fra-lh-business-nonschengen',
    name: 'Lufthansa Business Lounge',
    location: 'Terminal 1, Concourse B — Non-Schengen, Level 2',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['airline-own'],   // LH/LX/OS Business class; SA Gold gets Senator Lounge instead
    hours: 'Daily 05:30–22:30',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateProximity: [
      { prefix: 'B', minutes: 6 },
      { prefix: 'C', minutes: 11 },
    ],
  },
  {
    id: 'fra-skyteam-t2',
    name: 'Air France / SkyTeam Lounge',
    location: 'Terminal 2, Concourse Z — Level 2',
    area: 'non-schengen',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['skyteam', 'airline-own'],
    hours: 'Daily 06:00–22:00',
    amenities: ['Hot buffet', 'Bar', 'WiFi', 'Business desks'],
    gateProximity: [
      { prefix: 'Z', minutes: 5 },
      { prefix: 'D', minutes: 8 },
    ],
  },
  {
    id: 'fra-primeclass-t1',
    name: 'Primeclass Business Lounge',
    location: 'Terminal 1, Concourse A — Schengen, Level 1',
    area: 'schengen',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key'],
    hours: 'Daily 05:00–22:00',
    amenities: ['Buffet', 'Bar', 'WiFi', 'Showers'],
    gateProximity: [
      { prefix: 'A', minutes: 6 },
      { prefix: 'Z', minutes: 12 },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// SINGAPORE CHANGI (SIN)
// All flights are international — no Schengen equivalent.
// Gate layout: T1 → A gates, T2 → B gates, T3 → C/D gates, T4 → E gates.
// ──────────────────────────────────────────────────────────────────────────────
const SIN_LOUNGES: StaticLounge[] = [
  {
    id: 'sin-silverKris-business-t3',
    name: 'Singapore Airlines SilverKris Business Class Lounge',
    location: 'Terminal 3, Level 3 — near Gates C/D',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    hours: '24 hours',
    amenities: ['Noodle bar', 'Full buffet', 'Premium bar', 'Shower suites', 'Sleep areas'],
    gateProximity: [
      { prefix: 'C', minutes: 5 },
      { prefix: 'D', minutes: 6 },
      { prefix: 'B', minutes: 12 },
      { prefix: 'A', minutes: 18 },
    ],
  },
  {
    id: 'sin-silverKris-business-t2',
    name: 'Singapore Airlines SilverKris Business Class Lounge',
    location: 'Terminal 2, Level 3 — near Gates B',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['star-alliance', 'airline-own'],
    hours: '24 hours',
    amenities: ['Noodle bar', 'Full buffet', 'Bar', 'Shower suites', 'WiFi'],
    gateProximity: [
      { prefix: 'B', minutes: 4 },
      { prefix: 'A', minutes: 10 },
      { prefix: 'C', minutes: 12 },
    ],
  },
  {
    id: 'sin-private-room-t3',
    name: 'Singapore Airlines The Private Room',
    location: 'Terminal 3, Level 3 — adjacent to SilverKris Lounge',
    area: 'international',
    tier: 'ultra-premium',
    loungeClass: 'first',
    networks: ['airline-own'],   // SQ Suites/First class and KrisFlyer PPS Club only
    hours: '24 hours',
    amenities: ['Fine dining', 'Champagne bar', 'Private suites', 'Spa treatments', 'Chauffeur transfer'],
    gateProximity: [
      { prefix: 'C', minutes: 5 },
      { prefix: 'D', minutes: 6 },
    ],
  },
  {
    id: 'sin-qantas-t1',
    name: 'Qantas International Business Lounge',
    location: 'Terminal 1, Level 3 — near Gates A',
    area: 'international',
    tier: 'premium',
    loungeClass: 'business',
    networks: ['oneworld', 'airline-own'],
    hours: 'Daily 06:00–23:00 (flight dependent)',
    amenities: ['À la carte dining', 'Bar', 'Shower rooms', 'WiFi', 'Work area'],
    gateProximity: [
      { prefix: 'A', minutes: 5 },
      { prefix: 'B', minutes: 12 },
      { prefix: 'C', minutes: 18 },
    ],
  },
  {
    id: 'sin-sats-premier-t3',
    name: 'SATS Premier Lounge',
    location: 'Terminal 3, Level 3 — near Gates C',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    hours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Shower rooms', 'WiFi', 'Prayer room'],
    gateProximity: [
      { prefix: 'C', minutes: 6 },
      { prefix: 'D', minutes: 8 },
      { prefix: 'B', minutes: 14 },
    ],
  },
  {
    id: 'sin-sats-premier-t2',
    name: 'SATS Premier Lounge',
    location: 'Terminal 2, Level 3 — near Gates B',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    hours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Showers', 'WiFi'],
    gateProximity: [
      { prefix: 'B', minutes: 5 },
      { prefix: 'A', minutes: 11 },
    ],
  },
  {
    id: 'sin-sats-premier-t1',
    name: 'SATS Premier Lounge',
    location: 'Terminal 1, Level 3 — near Gates A',
    area: 'international',
    tier: 'standard',
    loungeClass: 'standard',
    networks: ['priority-pass', 'lounge-key', 'dragon-pass'],
    hours: '24 hours',
    amenities: ['Buffet', 'Bar', 'Showers', 'WiFi'],
    gateProximity: [
      { prefix: 'A', minutes: 5 },
      { prefix: 'B', minutes: 12 },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Master database — add new airports here
// ──────────────────────────────────────────────────────────────────────────────
export const LOUNGE_DATABASE: Readonly<Record<string, StaticLounge[]>> = {
  HEL: HEL_LOUNGES,
  FRA: FRA_LOUNGES,
  SIN: SIN_LOUNGES,
};
