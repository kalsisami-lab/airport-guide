export type AirportMeta = {
  city: string;
  country: string;
  inSchengen: boolean;
};

// Shared lookup: IATA → city / country / Schengen status.
// Used by both the flight API route (server) and Dashboard (client).
export const AIRPORT_META: Record<string, AirportMeta> = {
  // ── Europe — Schengen ────────────────────────────────────────────────────────
  HEL: { city: 'Helsinki',      country: 'Finland',         inSchengen: true  },
  TMP: { city: 'Tampere',       country: 'Finland',         inSchengen: true  },
  OUL: { city: 'Oulu',          country: 'Finland',         inSchengen: true  },
  TKU: { city: 'Turku',         country: 'Finland',         inSchengen: true  },
  CDG: { city: 'Paris',         country: 'France',          inSchengen: true  },
  ORY: { city: 'Paris',         country: 'France',          inSchengen: true  },
  NCE: { city: 'Nice',          country: 'France',          inSchengen: true  },
  LYS: { city: 'Lyon',          country: 'France',          inSchengen: true  },
  MRS: { city: 'Marseille',     country: 'France',          inSchengen: true  },
  FRA: { city: 'Frankfurt',     country: 'Germany',         inSchengen: true  },
  MUC: { city: 'Munich',        country: 'Germany',         inSchengen: true  },
  BER: { city: 'Berlin',        country: 'Germany',         inSchengen: true  },
  DUS: { city: 'Düsseldorf',    country: 'Germany',         inSchengen: true  },
  HAM: { city: 'Hamburg',       country: 'Germany',         inSchengen: true  },
  STR: { city: 'Stuttgart',     country: 'Germany',         inSchengen: true  },
  CGN: { city: 'Cologne',       country: 'Germany',         inSchengen: true  },
  AMS: { city: 'Amsterdam',     country: 'Netherlands',     inSchengen: true  },
  ARN: { city: 'Stockholm',     country: 'Sweden',          inSchengen: true  },
  GOT: { city: 'Gothenburg',    country: 'Sweden',          inSchengen: true  },
  CPH: { city: 'Copenhagen',    country: 'Denmark',         inSchengen: true  },
  OSL: { city: 'Oslo',          country: 'Norway',          inSchengen: true  },
  BGO: { city: 'Bergen',        country: 'Norway',          inSchengen: true  },
  ZRH: { city: 'Zurich',        country: 'Switzerland',     inSchengen: true  },
  GVA: { city: 'Geneva',        country: 'Switzerland',     inSchengen: true  },
  VIE: { city: 'Vienna',        country: 'Austria',         inSchengen: true  },
  FCO: { city: 'Rome',          country: 'Italy',           inSchengen: true  },
  MXP: { city: 'Milan',         country: 'Italy',           inSchengen: true  },
  LIN: { city: 'Milan',         country: 'Italy',           inSchengen: true  },
  VCE: { city: 'Venice',        country: 'Italy',           inSchengen: true  },
  NAP: { city: 'Naples',        country: 'Italy',           inSchengen: true  },
  MAD: { city: 'Madrid',        country: 'Spain',           inSchengen: true  },
  BCN: { city: 'Barcelona',     country: 'Spain',           inSchengen: true  },
  AGP: { city: 'Malaga',        country: 'Spain',           inSchengen: true  },
  ATH: { city: 'Athens',        country: 'Greece',          inSchengen: true  },
  SKG: { city: 'Thessaloniki',  country: 'Greece',          inSchengen: true  },
  HER: { city: 'Heraklion',     country: 'Greece',          inSchengen: true  },
  LIS: { city: 'Lisbon',        country: 'Portugal',        inSchengen: true  },
  OPO: { city: 'Porto',         country: 'Portugal',        inSchengen: true  },
  BRU: { city: 'Brussels',      country: 'Belgium',         inSchengen: true  },
  WAW: { city: 'Warsaw',        country: 'Poland',          inSchengen: true  },
  KRK: { city: 'Kraków',        country: 'Poland',          inSchengen: true  },
  PRG: { city: 'Prague',        country: 'Czech Republic',  inSchengen: true  },
  BUD: { city: 'Budapest',      country: 'Hungary',         inSchengen: true  },
  RIX: { city: 'Riga',          country: 'Latvia',          inSchengen: true  },
  TLL: { city: 'Tallinn',       country: 'Estonia',         inSchengen: true  },
  VNO: { city: 'Vilnius',       country: 'Lithuania',       inSchengen: true  },
  LUX: { city: 'Luxembourg',    country: 'Luxembourg',      inSchengen: true  },
  VLC: { city: 'Valencia',      country: 'Spain',           inSchengen: true  },
  PMI: { city: 'Palma',         country: 'Spain',           inSchengen: true  },
  REK: { city: 'Reykjavik',     country: 'Iceland',         inSchengen: true  },
  KEF: { city: 'Reykjavik',     country: 'Iceland',         inSchengen: true  },
  SOF: { city: 'Sofia',         country: 'Bulgaria',        inSchengen: false }, // EU but not Schengen yet
  OTP: { city: 'Bucharest',     country: 'Romania',         inSchengen: false }, // EU but not Schengen yet
  // ── Europe — Non-Schengen ────────────────────────────────────────────────────
  LHR: { city: 'London',        country: 'United Kingdom',  inSchengen: false },
  LGW: { city: 'London',        country: 'United Kingdom',  inSchengen: false },
  LCY: { city: 'London',        country: 'United Kingdom',  inSchengen: false },
  STN: { city: 'London',        country: 'United Kingdom',  inSchengen: false },
  LTN: { city: 'London',        country: 'United Kingdom',  inSchengen: false },
  MAN: { city: 'Manchester',    country: 'United Kingdom',  inSchengen: false },
  EDI: { city: 'Edinburgh',     country: 'United Kingdom',  inSchengen: false },
  GLA: { city: 'Glasgow',       country: 'United Kingdom',  inSchengen: false },
  BHX: { city: 'Birmingham',    country: 'United Kingdom',  inSchengen: false },
  DUB: { city: 'Dublin',        country: 'Ireland',         inSchengen: false },
  IST: { city: 'Istanbul',      country: 'Turkey',          inSchengen: false },
  SAW: { city: 'Istanbul',      country: 'Turkey',          inSchengen: false },
  ESB: { city: 'Ankara',        country: 'Turkey',          inSchengen: false },
  BEG: { city: 'Belgrade',      country: 'Serbia',          inSchengen: false },
  ZAG: { city: 'Zagreb',        country: 'Croatia',         inSchengen: true  },
  SKP: { city: 'Skopje',        country: 'North Macedonia', inSchengen: false },
  TIA: { city: 'Tirana',        country: 'Albania',         inSchengen: false },
  // ── North America ────────────────────────────────────────────────────────────
  JFK: { city: 'New York',      country: 'United States',   inSchengen: false },
  EWR: { city: 'Newark',        country: 'United States',   inSchengen: false },
  LGA: { city: 'New York',      country: 'United States',   inSchengen: false },
  LAX: { city: 'Los Angeles',   country: 'United States',   inSchengen: false },
  ORD: { city: 'Chicago',       country: 'United States',   inSchengen: false },
  MIA: { city: 'Miami',         country: 'United States',   inSchengen: false },
  DFW: { city: 'Dallas',        country: 'United States',   inSchengen: false },
  ATL: { city: 'Atlanta',       country: 'United States',   inSchengen: false },
  SFO: { city: 'San Francisco', country: 'United States',   inSchengen: false },
  BOS: { city: 'Boston',        country: 'United States',   inSchengen: false },
  SEA: { city: 'Seattle',       country: 'United States',   inSchengen: false },
  DEN: { city: 'Denver',        country: 'United States',   inSchengen: false },
  IAD: { city: 'Washington DC', country: 'United States',   inSchengen: false },
  DCA: { city: 'Washington DC', country: 'United States',   inSchengen: false },
  YYZ: { city: 'Toronto',       country: 'Canada',          inSchengen: false },
  YVR: { city: 'Vancouver',     country: 'Canada',          inSchengen: false },
  YUL: { city: 'Montreal',      country: 'Canada',          inSchengen: false },
  YYC: { city: 'Calgary',       country: 'Canada',          inSchengen: false },
  MEX: { city: 'Mexico City',   country: 'Mexico',          inSchengen: false },
  // ── Asia ─────────────────────────────────────────────────────────────────────
  HKG: { city: 'Hong Kong',     country: 'Hong Kong',       inSchengen: false },
  NRT: { city: 'Tokyo',         country: 'Japan',           inSchengen: false },
  HND: { city: 'Tokyo',         country: 'Japan',           inSchengen: false },
  KIX: { city: 'Osaka',         country: 'Japan',           inSchengen: false },
  ITM: { city: 'Osaka',         country: 'Japan',           inSchengen: false },
  SIN: { city: 'Singapore',     country: 'Singapore',       inSchengen: false },
  BKK: { city: 'Bangkok',       country: 'Thailand',        inSchengen: false },
  DMK: { city: 'Bangkok',       country: 'Thailand',        inSchengen: false },
  KUL: { city: 'Kuala Lumpur',  country: 'Malaysia',        inSchengen: false },
  ICN: { city: 'Seoul',         country: 'South Korea',     inSchengen: false },
  GMP: { city: 'Seoul',         country: 'South Korea',     inSchengen: false },
  PEK: { city: 'Beijing',       country: 'China',           inSchengen: false },
  PKX: { city: 'Beijing',       country: 'China',           inSchengen: false },
  PVG: { city: 'Shanghai',      country: 'China',           inSchengen: false },
  SHA: { city: 'Shanghai',      country: 'China',           inSchengen: false },
  CAN: { city: 'Guangzhou',     country: 'China',           inSchengen: false },
  SZX: { city: 'Shenzhen',      country: 'China',           inSchengen: false },
  DEL: { city: 'Delhi',         country: 'India',           inSchengen: false },
  BOM: { city: 'Mumbai',        country: 'India',           inSchengen: false },
  BLR: { city: 'Bangalore',     country: 'India',           inSchengen: false },
  MAA: { city: 'Chennai',       country: 'India',           inSchengen: false },
  CGK: { city: 'Jakarta',       country: 'Indonesia',       inSchengen: false },
  MNL: { city: 'Manila',        country: 'Philippines',     inSchengen: false },
  CEB: { city: 'Cebu',          country: 'Philippines',     inSchengen: false },
  SGN: { city: 'Ho Chi Minh City', country: 'Vietnam',      inSchengen: false },
  HAN: { city: 'Hanoi',         country: 'Vietnam',         inSchengen: false },
  RGN: { city: 'Yangon',        country: 'Myanmar',         inSchengen: false },
  CMB: { city: 'Colombo',       country: 'Sri Lanka',       inSchengen: false },
  DAC: { city: 'Dhaka',         country: 'Bangladesh',      inSchengen: false },
  KTM: { city: 'Kathmandu',     country: 'Nepal',           inSchengen: false },
  // ── Middle East ──────────────────────────────────────────────────────────────
  DXB: { city: 'Dubai',         country: 'UAE',             inSchengen: false },
  AUH: { city: 'Abu Dhabi',     country: 'UAE',             inSchengen: false },
  SHJ: { city: 'Sharjah',       country: 'UAE',             inSchengen: false },
  DOH: { city: 'Doha',          country: 'Qatar',           inSchengen: false },
  RUH: { city: 'Riyadh',        country: 'Saudi Arabia',    inSchengen: false },
  JED: { city: 'Jeddah',        country: 'Saudi Arabia',    inSchengen: false },
  BAH: { city: 'Bahrain',       country: 'Bahrain',         inSchengen: false },
  MCT: { city: 'Muscat',        country: 'Oman',            inSchengen: false },
  KWI: { city: 'Kuwait City',   country: 'Kuwait',          inSchengen: false },
  AMM: { city: 'Amman',         country: 'Jordan',          inSchengen: false },
  CAI: { city: 'Cairo',         country: 'Egypt',           inSchengen: false },
  TLV: { city: 'Tel Aviv',      country: 'Israel',          inSchengen: false },
  BEY: { city: 'Beirut',        country: 'Lebanon',         inSchengen: false },
  // ── Australia & Pacific ───────────────────────────────────────────────────────
  SYD: { city: 'Sydney',        country: 'Australia',       inSchengen: false },
  MEL: { city: 'Melbourne',     country: 'Australia',       inSchengen: false },
  BNE: { city: 'Brisbane',      country: 'Australia',       inSchengen: false },
  PER: { city: 'Perth',         country: 'Australia',       inSchengen: false },
  AKL: { city: 'Auckland',      country: 'New Zealand',     inSchengen: false },
  // ── South America ─────────────────────────────────────────────────────────────
  GRU: { city: 'São Paulo',     country: 'Brazil',          inSchengen: false },
  GIG: { city: 'Rio de Janeiro',country: 'Brazil',          inSchengen: false },
  EZE: { city: 'Buenos Aires',  country: 'Argentina',       inSchengen: false },
  BOG: { city: 'Bogotá',        country: 'Colombia',        inSchengen: false },
  SCL: { city: 'Santiago',      country: 'Chile',           inSchengen: false },
  LIM: { city: 'Lima',          country: 'Peru',            inSchengen: false },
  // ── Africa ───────────────────────────────────────────────────────────────────
  JNB: { city: 'Johannesburg',  country: 'South Africa',    inSchengen: false },
  CPT: { city: 'Cape Town',     country: 'South Africa',    inSchengen: false },
  NBO: { city: 'Nairobi',       country: 'Kenya',           inSchengen: false },
  ADD: { city: 'Addis Ababa',   country: 'Ethiopia',        inSchengen: false },
  CMN: { city: 'Casablanca',    country: 'Morocco',         inSchengen: false },
  RAK: { city: 'Marrakech',     country: 'Morocco',         inSchengen: false },
  LOS: { city: 'Lagos',         country: 'Nigeria',         inSchengen: false },
  ACC: { city: 'Accra',         country: 'Ghana',           inSchengen: false },
};

// ── Region classification ──────────────────────────────────────────────────────
export type AirportRegion =
  | 'schengen-europe'
  | 'non-schengen-europe'
  | 'asia-pacific'
  | 'middle-east'
  | 'north-america'
  | 'latin-america'
  | 'africa'
  | 'oceania';

const COUNTRY_TO_REGION: Partial<Record<string, AirportRegion>> = {
  'United States': 'north-america', 'Canada': 'north-america',
  'Mexico': 'latin-america', 'Brazil': 'latin-america', 'Argentina': 'latin-america',
  'Chile': 'latin-america', 'Colombia': 'latin-america', 'Peru': 'latin-america',
  'Japan': 'asia-pacific', 'China': 'asia-pacific', 'Hong Kong': 'asia-pacific',
  'Singapore': 'asia-pacific', 'South Korea': 'asia-pacific', 'Thailand': 'asia-pacific',
  'Malaysia': 'asia-pacific', 'Indonesia': 'asia-pacific', 'Philippines': 'asia-pacific',
  'Vietnam': 'asia-pacific', 'India': 'asia-pacific', 'Sri Lanka': 'asia-pacific',
  'Bangladesh': 'asia-pacific', 'Nepal': 'asia-pacific', 'Myanmar': 'asia-pacific',
  'Taiwan': 'asia-pacific',
  'Australia': 'oceania', 'New Zealand': 'oceania',
  'UAE': 'middle-east', 'Qatar': 'middle-east', 'Saudi Arabia': 'middle-east',
  'Kuwait': 'middle-east', 'Bahrain': 'middle-east', 'Oman': 'middle-east',
  'Israel': 'middle-east', 'Jordan': 'middle-east', 'Lebanon': 'middle-east',
  'Egypt': 'africa', 'Morocco': 'africa', 'South Africa': 'africa',
  'Kenya': 'africa', 'Ethiopia': 'africa', 'Nigeria': 'africa', 'Ghana': 'africa',
  'United Kingdom': 'non-schengen-europe', 'Ireland': 'non-schengen-europe',
  'Turkey': 'non-schengen-europe', 'Serbia': 'non-schengen-europe',
  'North Macedonia': 'non-schengen-europe', 'Albania': 'non-schengen-europe',
  'Montenegro': 'non-schengen-europe', 'Bulgaria': 'non-schengen-europe',
  'Romania': 'non-schengen-europe',
};

const REGION_LABELS: Record<AirportRegion, string> = {
  'schengen-europe':     'Schengen Europe',
  'non-schengen-europe': 'Europe',
  'asia-pacific':        'Asia-Pacific',
  'middle-east':         'Middle East',
  'north-america':       'North America',
  'latin-america':       'Latin America',
  'africa':              'Africa',
  'oceania':             'Oceania',
};

export function getAirportRegion(iata: string): AirportRegion | null {
  const meta = AIRPORT_META[iata];
  if (!meta) return null;
  if (meta.inSchengen) return 'schengen-europe';
  return COUNTRY_TO_REGION[meta.country] ?? null;
}

export function getRegionLabel(iata: string): string {
  const region = getAirportRegion(iata);
  return region ? REGION_LABELS[region] : 'International';
}

// Schengen country ISO2 set — used by the airports API route
export const SCHENGEN_ISO2 = new Set([
  'AT', 'BE', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL',
  'NO', 'PL', 'PT', 'SK', 'SI', 'ES', 'SE', 'CH',
]);

export function isSchengenCountry(iso2: string): boolean {
  return SCHENGEN_ISO2.has(iso2.toUpperCase());
}
