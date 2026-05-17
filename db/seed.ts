/**
 * Seed script — run once to populate the entitlement database.
 * Usage:  npx tsx db/seed.ts
 *
 * Design note: every INSERT uses explicit column objects so the TypeScript
 * compiler will catch schema drift immediately.
 */
import { db } from './client';
import {
  alliances, airlines, frequentFlyerPrograms, statusTiers,
  airports, terminals, lounges,
  loungeAccessChannels, loungeAccessRules,
  airportServiceRules,
} from './schema';

// ─── 1. Alliances ─────────────────────────────────────────────────────────────

const [oneworld, starAlliance, skyteam] = db
  .insert(alliances)
  .values([
    { code: 'oneworld',      name: 'Oneworld' },
    { code: 'star_alliance', name: 'Star Alliance' },
    { code: 'skyteam',       name: 'SkyTeam' },
  ])
  .returning()
  .all();

console.log('✓ alliances');

// ─── 2. Airlines ──────────────────────────────────────────────────────────────

const airlineRows = db
  .insert(airlines)
  .values([
    // Oneworld
    { iataCode: 'AY', name: 'Finnair',             allianceId: oneworld.id },
    { iataCode: 'BA', name: 'British Airways',      allianceId: oneworld.id },
    { iataCode: 'IB', name: 'Iberia',               allianceId: oneworld.id },
    { iataCode: 'QR', name: 'Qatar Airways',        allianceId: oneworld.id },
    { iataCode: 'JL', name: 'Japan Airlines',       allianceId: oneworld.id },
    { iataCode: 'AA', name: 'American Airlines',    allianceId: oneworld.id },
    // Star Alliance
    { iataCode: 'LH', name: 'Lufthansa',            allianceId: starAlliance.id },
    { iataCode: 'LX', name: 'Swiss Int\'l Air Lines', allianceId: starAlliance.id },
    { iataCode: 'TK', name: 'Turkish Airlines',     allianceId: starAlliance.id },
    { iataCode: 'UA', name: 'United Airlines',      allianceId: starAlliance.id },
    { iataCode: 'NH', name: 'ANA',                  allianceId: starAlliance.id },
    // SkyTeam
    { iataCode: 'AF', name: 'Air France',           allianceId: skyteam.id },
    { iataCode: 'KL', name: 'KLM',                  allianceId: skyteam.id },
    { iataCode: 'DL', name: 'Delta Air Lines',      allianceId: skyteam.id },
    // Independent (alliance = null)
    { iataCode: 'EK', name: 'Emirates',             allianceId: null },
    { iataCode: 'B6', name: 'JetBlue',              allianceId: null },
    { iataCode: 'U2', name: 'easyJet',              allianceId: null },
  ])
  .returning()
  .all();

const airline = Object.fromEntries(airlineRows.map((a) => [a.iataCode, a]));
console.log('✓ airlines');

// ─── 3. Frequent Flyer Programmes ────────────────────────────────────────────

const ffpRows = db
  .insert(frequentFlyerPrograms)
  .values([
    { airlineId: airline.AY.id, name: 'Finnair Plus',          code: 'ay-plus' },
    { airlineId: airline.BA.id, name: 'British Airways Executive Club', code: 'ba-exec-club' },
    { airlineId: airline.IB.id, name: 'Iberia Plus',           code: 'ib-plus' },
    { airlineId: airline.QR.id, name: 'Qatar Privilege Club',  code: 'qr-privilege' },
    { airlineId: airline.JL.id, name: 'JAL Mileage Bank',      code: 'jl-mileage' },
    { airlineId: airline.AA.id, name: 'AAdvantage',            code: 'aa-advantage' },
    { airlineId: airline.LH.id, name: 'Miles & More',          code: 'lh-miles-more' },
    { airlineId: airline.LX.id, name: 'Miles & More (Swiss)',  code: 'lx-miles-more' },
    { airlineId: airline.TK.id, name: 'Turkish Miles&Smiles',  code: 'tk-miles-smiles' },
    { airlineId: airline.UA.id, name: 'MileagePlus',           code: 'ua-mileageplus' },
    { airlineId: airline.NH.id, name: 'ANA Mileage Club',      code: 'nh-amc' },
    { airlineId: airline.AF.id, name: 'Flying Blue',           code: 'af-flying-blue' },
    { airlineId: airline.KL.id, name: 'Flying Blue (KLM)',     code: 'kl-flying-blue' },
    { airlineId: airline.DL.id, name: 'SkyMiles',              code: 'dl-skymiles' },
    { airlineId: airline.EK.id, name: 'Emirates Skywards',     code: 'ek-skywards' },
  ])
  .returning()
  .all();

const ffp = Object.fromEntries(ffpRows.map((p) => [p.code, p]));
console.log('✓ frequent_flyer_programs');

// ─── 4. Status Tiers ─────────────────────────────────────────────────────────

db.insert(statusTiers).values([
  // Finnair Plus
  { programId: ffp['ay-plus'].id, tierName: 'Basic',    allianceTier: 'none',               fastTrack: false },
  { programId: ffp['ay-plus'].id, tierName: 'Silver',   allianceTier: 'oneworld_ruby',       fastTrack: false },
  { programId: ffp['ay-plus'].id, tierName: 'Gold',     allianceTier: 'oneworld_sapphire',   fastTrack: true  },
  { programId: ffp['ay-plus'].id, tierName: 'Platinum', allianceTier: 'oneworld_emerald',    fastTrack: true  },
  { programId: ffp['ay-plus'].id, tierName: 'Lumo',     allianceTier: 'oneworld_emerald',    fastTrack: true  },

  // British Airways Executive Club
  { programId: ffp['ba-exec-club'].id, tierName: 'Blue',     allianceTier: 'none',             fastTrack: false },
  { programId: ffp['ba-exec-club'].id, tierName: 'Bronze',   allianceTier: 'oneworld_ruby',    fastTrack: false },
  { programId: ffp['ba-exec-club'].id, tierName: 'Silver',   allianceTier: 'oneworld_sapphire',fastTrack: true  },
  { programId: ffp['ba-exec-club'].id, tierName: 'Gold',     allianceTier: 'oneworld_emerald', fastTrack: true  },

  // Qatar Privilege Club
  { programId: ffp['qr-privilege'].id, tierName: 'Burgundy', allianceTier: 'none',             fastTrack: false },
  { programId: ffp['qr-privilege'].id, tierName: 'Silver',   allianceTier: 'oneworld_ruby',    fastTrack: false },
  { programId: ffp['qr-privilege'].id, tierName: 'Gold',     allianceTier: 'oneworld_sapphire',fastTrack: true  },
  { programId: ffp['qr-privilege'].id, tierName: 'Platinum', allianceTier: 'oneworld_emerald', fastTrack: true  },

  // JAL Mileage Bank
  { programId: ffp['jl-mileage'].id, tierName: 'JMB',          allianceTier: 'none',             fastTrack: false },
  { programId: ffp['jl-mileage'].id, tierName: 'JMB Crystal',  allianceTier: 'oneworld_ruby',    fastTrack: false },
  { programId: ffp['jl-mileage'].id, tierName: 'JMB Sapphire', allianceTier: 'oneworld_sapphire',fastTrack: true  },
  { programId: ffp['jl-mileage'].id, tierName: 'JMB Diamond',  allianceTier: 'oneworld_emerald', fastTrack: true  },

  // Lufthansa Miles & More
  { programId: ffp['lh-miles-more'].id, tierName: 'Member',   allianceTier: 'none',         fastTrack: false },
  { programId: ffp['lh-miles-more'].id, tierName: 'Frequent', allianceTier: 'star_silver',  fastTrack: false },
  { programId: ffp['lh-miles-more'].id, tierName: 'Senator',  allianceTier: 'star_gold',    fastTrack: true  },
  { programId: ffp['lh-miles-more'].id, tierName: 'HON Circle',allianceTier: 'star_gold',   fastTrack: true  },

  // Turkish Miles&Smiles
  { programId: ffp['tk-miles-smiles'].id, tierName: 'Classic Plus', allianceTier: 'none',       fastTrack: false },
  { programId: ffp['tk-miles-smiles'].id, tierName: 'Elite',        allianceTier: 'star_silver',fastTrack: false },
  { programId: ffp['tk-miles-smiles'].id, tierName: 'Elite Plus',   allianceTier: 'star_gold',  fastTrack: true  },

  // United MileagePlus
  { programId: ffp['ua-mileageplus'].id, tierName: 'Member',   allianceTier: 'none',       fastTrack: false },
  { programId: ffp['ua-mileageplus'].id, tierName: 'Silver',   allianceTier: 'star_silver',fastTrack: false },
  { programId: ffp['ua-mileageplus'].id, tierName: 'Gold',     allianceTier: 'star_gold',  fastTrack: true  },
  { programId: ffp['ua-mileageplus'].id, tierName: 'Platinum', allianceTier: 'star_gold',  fastTrack: true  },
  { programId: ffp['ua-mileageplus'].id, tierName: '1K',       allianceTier: 'star_gold',  fastTrack: true  },

  // Air France Flying Blue
  { programId: ffp['af-flying-blue'].id, tierName: 'Explorer',  allianceTier: 'none',             fastTrack: false },
  { programId: ffp['af-flying-blue'].id, tierName: 'Silver',    allianceTier: 'skyteam_elite',    fastTrack: false },
  { programId: ffp['af-flying-blue'].id, tierName: 'Gold',      allianceTier: 'skyteam_elite_plus',fastTrack: true },
  { programId: ffp['af-flying-blue'].id, tierName: 'Platinum',  allianceTier: 'skyteam_elite_plus',fastTrack: true },
  { programId: ffp['af-flying-blue'].id, tierName: 'Ultimate',  allianceTier: 'skyteam_elite_plus',fastTrack: true },

  // Delta SkyMiles
  { programId: ffp['dl-skymiles'].id, tierName: 'Member',    allianceTier: 'none',              fastTrack: false },
  { programId: ffp['dl-skymiles'].id, tierName: 'Silver',    allianceTier: 'skyteam_elite',     fastTrack: false },
  { programId: ffp['dl-skymiles'].id, tierName: 'Gold',      allianceTier: 'skyteam_elite_plus',fastTrack: true  },
  { programId: ffp['dl-skymiles'].id, tierName: 'Platinum',  allianceTier: 'skyteam_elite_plus',fastTrack: true  },
  { programId: ffp['dl-skymiles'].id, tierName: 'Diamond',   allianceTier: 'skyteam_elite_plus',fastTrack: true  },

  // Emirates Skywards (alliance_id = null → tier = none for our engine)
  { programId: ffp['ek-skywards'].id, tierName: 'Blue',     allianceTier: 'none', fastTrack: false },
  { programId: ffp['ek-skywards'].id, tierName: 'Silver',   allianceTier: 'none', fastTrack: false },
  { programId: ffp['ek-skywards'].id, tierName: 'Gold',     allianceTier: 'none', fastTrack: true  },
  { programId: ffp['ek-skywards'].id, tierName: 'Platinum', allianceTier: 'none', fastTrack: true  },
]).run();

console.log('✓ status_tiers');

// ─── 5. Airports ──────────────────────────────────────────────────────────────

const airportRows = db
  .insert(airports)
  .values([
    { iataCode: 'HEL', name: 'Helsinki-Vantaa Airport',   city: 'Helsinki',    countryCode: 'FI' },
    { iataCode: 'LHR', name: 'London Heathrow Airport',   city: 'London',      countryCode: 'GB' },
    { iataCode: 'FRA', name: 'Frankfurt Airport',          city: 'Frankfurt',   countryCode: 'DE' },
    { iataCode: 'JFK', name: 'John F. Kennedy Intl Airport', city: 'New York', countryCode: 'US' },
    { iataCode: 'DXB', name: 'Dubai International Airport', city: 'Dubai',     countryCode: 'AE' },
  ])
  .returning()
  .all();

const apt = Object.fromEntries(airportRows.map((a) => [a.iataCode, a]));
console.log('✓ airports');

// ─── 6. Terminals ─────────────────────────────────────────────────────────────

const terminalRows = db
  .insert(terminals)
  .values([
    // HEL — single terminal, split by Schengen side
    { airportId: apt.HEL.id, name: 'Main Terminal (Schengen)',     schengenArea: true  },
    { airportId: apt.HEL.id, name: 'Main Terminal (Non-Schengen)', schengenArea: false },
    // LHR
    { airportId: apt.LHR.id, name: 'Terminal 2',  schengenArea: false },
    { airportId: apt.LHR.id, name: 'Terminal 3',  schengenArea: false },
    { airportId: apt.LHR.id, name: 'Terminal 4',  schengenArea: false },
    { airportId: apt.LHR.id, name: 'Terminal 5',  schengenArea: false },
    // FRA
    { airportId: apt.FRA.id, name: 'Terminal 1 (Schengen)',     schengenArea: true  },
    { airportId: apt.FRA.id, name: 'Terminal 1 (Non-Schengen)', schengenArea: false },
    { airportId: apt.FRA.id, name: 'Terminal 2',                schengenArea: false },
    // JFK
    { airportId: apt.JFK.id, name: 'Terminal 4',  schengenArea: false },
    { airportId: apt.JFK.id, name: 'Terminal 7',  schengenArea: false },
    { airportId: apt.JFK.id, name: 'Terminal 8',  schengenArea: false },
    // DXB
    { airportId: apt.DXB.id, name: 'Terminal 1',  schengenArea: false },
    { airportId: apt.DXB.id, name: 'Terminal 3',  schengenArea: false },
  ])
  .returning()
  .all();

// Build a map: airport iata + terminal name → terminal row
const term: Record<string, typeof terminalRows[0]> = {};
for (const t of terminalRows) {
  const ap = airportRows.find((a) => a.id === t.airportId)!;
  term[`${ap.iataCode}::${t.name}`] = t;
}
console.log('✓ terminals');

// ─── 7. Lounges ───────────────────────────────────────────────────────────────

const loungeRows = db
  .insert(lounges)
  .values([
    // ── HEL ──────────────────────────────────────────────────────────────────
    {
      airportId:           apt.HEL.id,
      terminalId:          term['HEL::Main Terminal (Non-Schengen)'].id,
      name:                'Finnair Platinum Wing',
      locationDescription: 'Non-Schengen, Level 3 — between Gates 30 and 36',
      tier:                'ultra_premium',
      loungeClass:         'first',
      area:                'non_schengen',
      openingHours:        'Daily 05:00–22:00',
      amenities:           ['À la carte dining', 'Premium bar', 'Spa & sauna', 'Shower suites', 'High-speed WiFi'],
    },
    {
      airportId:           apt.HEL.id,
      terminalId:          term['HEL::Main Terminal (Non-Schengen)'].id,
      name:                'Finnair Lounge',
      locationDescription: 'Non-Schengen, Level 3 — near Gate 30',
      tier:                'premium',
      loungeClass:         'business',
      area:                'non_schengen',
      openingHours:        'Daily 05:00–22:00',
      amenities:           ['Hot & cold buffet', 'Bar', 'Shower suites', 'WiFi', 'Work desks'],
    },
    {
      airportId:           apt.HEL.id,
      terminalId:          term['HEL::Main Terminal (Schengen)'].id,
      name:                'Finnair Lounge',
      locationDescription: 'Schengen, Level 2 — Pier C, near Gates 22–26',
      tier:                'premium',
      loungeClass:         'business',
      area:                'schengen',
      openingHours:        'Daily 05:00–22:00',
      amenities:           ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi'],
    },
    {
      airportId:           apt.HEL.id,
      terminalId:          term['HEL::Main Terminal (Schengen)'].id,
      name:                'Helsinki Airport Lounge',
      locationDescription: 'Schengen, Level 2 — Pier B, near Gate 21',
      tier:                'standard',
      loungeClass:         'standard',
      area:                'schengen',
      openingHours:        'Daily 05:00–21:00',
      amenities:           ['Buffet', 'Bar', 'WiFi', 'TV lounge'],
    },
    // ── FRA ──────────────────────────────────────────────────────────────────
    {
      airportId:           apt.FRA.id,
      terminalId:          term['FRA::Terminal 1 (Non-Schengen)'].id,
      name:                'Japan Airlines Sakura Lounge',
      locationDescription: 'Concourse B, Level 2 — Non-Schengen (near Gate B18)',
      tier:                'premium',
      loungeClass:         'business',
      area:                'non_schengen',
      openingHours:        'Daily 09:00–15:00',
      amenities:           ['Japanese cuisine', 'Bar', 'Shower rooms', 'WiFi'],
    },
    {
      airportId:           apt.FRA.id,
      terminalId:          term['FRA::Terminal 1 (Non-Schengen)'].id,
      name:                'Qatar Airways Business Lounge',
      locationDescription: 'Concourse B, Level 2 — Non-Schengen (near Gate B44)',
      tier:                'premium',
      loungeClass:         'business',
      area:                'non_schengen',
      openingHours:        'Daily 08:00–16:00',
      amenities:           ['À la carte dining', 'Premium bar', 'Shower rooms', 'WiFi'],
    },
    {
      airportId:           apt.FRA.id,
      terminalId:          term['FRA::Terminal 1 (Non-Schengen)'].id,
      name:                'Lufthansa Senator Lounge',
      locationDescription: 'Concourse B, Level 3 — Non-Schengen',
      tier:                'premium',
      loungeClass:         'business',
      area:                'non_schengen',
      openingHours:        'Daily 05:30–22:30',
      amenities:           ['Hot food station', 'Premium bar', 'Shower suites', 'WiFi', 'Business centre'],
    },
    {
      airportId:           apt.FRA.id,
      terminalId:          term['FRA::Terminal 1 (Schengen)'].id,
      name:                'Lufthansa Senator Lounge',
      locationDescription: 'Concourse A, Level 2 — Schengen',
      tier:                'premium',
      loungeClass:         'business',
      area:                'schengen',
      openingHours:        'Daily 05:30–22:30',
      amenities:           ['Hot & cold buffet', 'Bar', 'Shower rooms', 'WiFi'],
    },
    {
      airportId:           apt.FRA.id,
      terminalId:          term['FRA::Terminal 1 (Non-Schengen)'].id,
      name:                'Lufthansa First Class Lounge',
      locationDescription: 'Concourse B, Level 4 — Non-Schengen',
      tier:                'ultra_premium',
      loungeClass:         'first',
      area:                'non_schengen',
      openingHours:        'Daily 05:30–22:30',
      amenities:           ['Gourmet à la carte', 'Cigar lounge', 'Spa', 'Private suites', 'Personal butler'],
    },
    // ── LHR ──────────────────────────────────────────────────────────────────
    {
      airportId:           apt.LHR.id,
      terminalId:          term['LHR::Terminal 5'].id,
      name:                'British Airways Concorde Room',
      locationDescription: 'Level 5 — above Galleries First',
      tier:                'ultra_premium',
      loungeClass:         'first',
      area:                'international',
      openingHours:        'Daily 05:00–22:00',
      amenities:           ['Fine dining', 'Champagne bar', 'Daybeds', 'Spa treatments', 'Personal host'],
    },
    {
      airportId:           apt.LHR.id,
      terminalId:          term['LHR::Terminal 5'].id,
      name:                'British Airways Galleries Club Lounge',
      locationDescription: 'Level 4 — Terminal 5',
      tier:                'premium',
      loungeClass:         'business',
      area:                'international',
      openingHours:        'Daily 05:00–22:00',
      amenities:           ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    },
    // ── JFK ──────────────────────────────────────────────────────────────────
    {
      airportId:           apt.JFK.id,
      terminalId:          term['JFK::Terminal 8'].id,
      name:                'American Airlines Flagship Lounge',
      locationDescription: 'Level 3 — after security',
      tier:                'ultra_premium',
      loungeClass:         'first',
      area:                'international',
      openingHours:        'Daily 05:30–23:00',
      amenities:           ['À la carte dining', 'Premium bar', 'Shower suites', 'Spa', 'WiFi'],
    },
    {
      airportId:           apt.JFK.id,
      terminalId:          term['JFK::Terminal 8'].id,
      name:                'American Airlines Admirals Club',
      locationDescription: 'Level 3 — after security',
      tier:                'premium',
      loungeClass:         'business',
      area:                'international',
      openingHours:        'Daily 05:30–23:00',
      amenities:           ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi', 'Work desks'],
    },
    // ── DXB ──────────────────────────────────────────────────────────────────
    {
      airportId:           apt.DXB.id,
      terminalId:          term['DXB::Terminal 3'].id,
      name:                'Emirates First Class Lounge',
      locationDescription: 'Concourse B, Level 3',
      tier:                'ultra_premium',
      loungeClass:         'first',
      area:                'international',
      openingHours:        '24 hours',
      amenities:           ['À la carte dining', 'Bar', 'Spa', 'Jacuzzi', 'Sleep pods', 'WiFi'],
    },
    {
      airportId:           apt.DXB.id,
      terminalId:          term['DXB::Terminal 3'].id,
      name:                'Emirates Business Class Lounge',
      locationDescription: 'Concourses A, B, C — multiple lounges',
      tier:                'premium',
      loungeClass:         'business',
      area:                'international',
      openingHours:        '24 hours',
      amenities:           ['Hot buffet', 'Bar', 'Shower rooms', 'WiFi'],
    },
  ])
  .returning()
  .all();

// Quick lookup by name + airport
const lounge = (aptCode: string, loungeName: string) =>
  loungeRows.find((l) => {
    const ap = airportRows.find((a) => a.id === l.airportId)!;
    return ap.iataCode === aptCode && l.name === loungeName;
  })!;

console.log('✓ lounges');

// ─── 8. Access Channels & Rules ───────────────────────────────────────────────
// Pattern: insert channel → get id → insert rule(s) for that channel.

function addChannel(
  loungeId: number,
  channelType: typeof loungeAccessChannels.$inferInsert['channelType'],
  allianceAccess?: 'all_alliance' | 'carrier_specific',
) {
  return db
    .insert(loungeAccessChannels)
    .values({ loungeId, channelType, allianceAccess })
    .returning()
    .get();
}

function addRule(
  channelId: number,
  opts: {
    minAllianceTier?: typeof loungeAccessRules.$inferInsert['minAllianceTier'];
    carrierRestriction?: string[];
    confidence?: number;
    sourceUrl?: string;
  } = {},
) {
  db.insert(loungeAccessRules).values({
    channelId,
    minAllianceTier:    opts.minAllianceTier,
    carrierRestriction: opts.carrierRestriction ?? null,
    confidence:         opts.confidence ?? 0.95,
    sourceUrl:          opts.sourceUrl ?? null,
  }).run();
}

// ── HEL: Finnair Platinum Wing ────────────────────────────────────────────────
const platWing = lounge('HEL', 'Finnair Platinum Wing');
// Channel 1: carrier-specific oneworld status (AY only, Emerald)
const ch1 = addChannel(platWing.id, 'alliance_status', 'carrier_specific');
addRule(ch1.id, {
  minAllianceTier:    'oneworld_emerald',
  carrierRestriction: ['AY'],
  confidence:         0.99,
  sourceUrl:          'https://www.finnair.com/en/fly-finnair/finnair-plus/platinum-wing',
});

// ── HEL: Finnair Lounge (Non-Schengen) ───────────────────────────────────────
const helLoungeNS = loungeRows.find(
  (l) => l.airportId === apt.HEL.id && l.name === 'Finnair Lounge' && l.area === 'non_schengen',
)!;
// Channel: carrier-specific Sapphire+
const ch2 = addChannel(helLoungeNS.id, 'alliance_status', 'carrier_specific');
addRule(ch2.id, { minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AY'], confidence: 0.99 });

// ── HEL: Finnair Lounge (Schengen) ────────────────────────────────────────────
const helLoungeSC = loungeRows.find(
  (l) => l.airportId === apt.HEL.id && l.name === 'Finnair Lounge' && l.area === 'schengen',
)!;
const ch3 = addChannel(helLoungeSC.id, 'alliance_status', 'carrier_specific');
addRule(ch3.id, { minAllianceTier: 'oneworld_sapphire', carrierRestriction: ['AY'], confidence: 0.99 });

// ── HEL: Helsinki Airport Lounge ─────────────────────────────────────────────
const helAirportLounge = lounge('HEL', 'Helsinki Airport Lounge');
const ch4 = addChannel(helAirportLounge.id, 'priority_pass');
addRule(ch4.id, { confidence: 0.99 });
const ch4b = addChannel(helAirportLounge.id, 'lounge_key');
addRule(ch4b.id, { confidence: 0.99 });
const ch4c = addChannel(helAirportLounge.id, 'dragon_pass');
addRule(ch4c.id, { confidence: 0.99 });

// ── FRA: JAL Sakura — all oneworld Sapphire+ ─────────────────────────────────
const jalSakura = lounge('FRA', 'Japan Airlines Sakura Lounge');
const ch5 = addChannel(jalSakura.id, 'alliance_status', 'all_alliance');
addRule(ch5.id, {
  minAllianceTier: 'oneworld_sapphire',
  confidence:      0.90,
  sourceUrl:       'https://www.jal.co.jp/en/inter/service/lounge/fra/',
});

// ── FRA: Qatar Airways Business — all oneworld Sapphire+ ─────────────────────
const fraQR = lounge('FRA', 'Qatar Airways Business Lounge');
const ch6 = addChannel(fraQR.id, 'alliance_status', 'all_alliance');
addRule(ch6.id, { minAllianceTier: 'oneworld_sapphire', confidence: 0.90 });

// ── FRA: Lufthansa Senator (both zones) — all Star Alliance Gold ──────────────
for (const lhSenator of loungeRows.filter(
  (l) => l.airportId === apt.FRA.id && l.name === 'Lufthansa Senator Lounge',
)) {
  const ch = addChannel(lhSenator.id, 'alliance_status', 'all_alliance');
  addRule(ch.id, { minAllianceTier: 'star_gold', confidence: 0.99 });
  const chPP = addChannel(lhSenator.id, 'priority_pass');
  addRule(chPP.id, { confidence: 0.85 });
}

// ── FRA: Lufthansa First Class — carrier-specific, LH Gold (HON Circle)  ──────
const fraLHFirst = lounge('FRA', 'Lufthansa First Class Lounge');
const ch7 = addChannel(fraLHFirst.id, 'airline_own');
addRule(ch7.id, {
  carrierRestriction: ['LH', 'LX', 'OS', 'SN'],
  confidence:         0.99,
});

// ── LHR: BA Concorde Room — carrier-specific Emerald ─────────────────────────
const baConc = lounge('LHR', 'British Airways Concorde Room');
const ch8 = addChannel(baConc.id, 'alliance_status', 'carrier_specific');
addRule(ch8.id, { minAllianceTier: 'oneworld_emerald', carrierRestriction: ['BA', 'IB'], confidence: 0.99 });

// ── LHR: BA Galleries Club — all oneworld Sapphire+ ──────────────────────────
const baGalleries = lounge('LHR', 'British Airways Galleries Club Lounge');
const ch9 = addChannel(baGalleries.id, 'alliance_status', 'all_alliance');
addRule(ch9.id, { minAllianceTier: 'oneworld_sapphire', confidence: 0.99 });

// ── JFK: AA Flagship — all oneworld Emerald ───────────────────────────────────
const jfkFlagship = lounge('JFK', 'American Airlines Flagship Lounge');
const ch10 = addChannel(jfkFlagship.id, 'alliance_status', 'all_alliance');
addRule(ch10.id, { minAllianceTier: 'oneworld_emerald', confidence: 0.95 });

// ── JFK: AA Admirals Club — all oneworld Sapphire+ ────────────────────────────
const jfkAdmirals = lounge('JFK', 'American Airlines Admirals Club');
const ch11 = addChannel(jfkAdmirals.id, 'alliance_status', 'all_alliance');
addRule(ch11.id, { minAllianceTier: 'oneworld_sapphire', confidence: 0.95 });
const ch11b = addChannel(jfkAdmirals.id, 'priority_pass');
addRule(ch11b.id, { confidence: 0.85 });

// ── DXB: Emirates First & Business — carrier-specific, no alliance ────────────
const dxbFirst = lounge('DXB', 'Emirates First Class Lounge');
const ch12 = addChannel(dxbFirst.id, 'airline_own');
addRule(ch12.id, { carrierRestriction: ['EK'], confidence: 0.99 });

const dxbBusiness = lounge('DXB', 'Emirates Business Class Lounge');
const ch13 = addChannel(dxbBusiness.id, 'airline_own');
addRule(ch13.id, { carrierRestriction: ['EK'], confidence: 0.99 });

console.log('✓ lounge_access_channels + lounge_access_rules');

// ─── 9. Airport Service Rules (Fast Track) ────────────────────────────────────

db.insert(airportServiceRules).values([
  // HEL fast track — Sapphire+ or SA Gold or ST Elite Plus; NOT credit cards
  {
    airportId:       apt.HEL.id,
    serviceType:     'fast_track',
    minAllianceTier: 'oneworld_sapphire',
    confidence:      0.99,
    sourceUrl:       'https://www.finavia.fi/en/airports/helsinki-airport/services/fast-track',
  },
  {
    airportId:       apt.HEL.id,
    serviceType:     'fast_track',
    minAllianceTier: 'star_gold',
    confidence:      0.95,
  },
  {
    airportId:       apt.HEL.id,
    serviceType:     'fast_track',
    minAllianceTier: 'skyteam_elite_plus',
    confidence:      0.90,
  },
  // LHR fast track — BA Gold+ (Emerald), carrier-specific
  {
    airportId:         apt.LHR.id,
    serviceType:       'fast_track',
    minAllianceTier:   'oneworld_sapphire',
    carrierRestriction: ['BA', 'IB'],
    confidence:        0.95,
  },
  // FRA fast track — LH Senator+
  {
    airportId:       apt.FRA.id,
    serviceType:     'fast_track',
    minAllianceTier: 'star_gold',
    confidence:      0.95,
  },
]).run();

console.log('✓ airport_service_rules');
console.log('\n🌱 Seed complete.');
