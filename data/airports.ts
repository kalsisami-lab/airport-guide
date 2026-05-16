export type Airport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  terminal: string;
  inSchengen: boolean;
};

export const airports: Airport[] = [
  // Europe — Schengen
  { iata: 'HEL', name: 'Helsinki-Vantaa',           city: 'Helsinki',       country: 'Finland',         terminal: 'Main Terminal',   inSchengen: true  },
  { iata: 'AMS', name: 'Amsterdam Schiphol',         city: 'Amsterdam',      country: 'Netherlands',     terminal: 'Main Terminal',   inSchengen: true  },
  { iata: 'ARN', name: 'Stockholm Arlanda',          city: 'Stockholm',      country: 'Sweden',          terminal: 'Terminal 5',      inSchengen: true  },
  { iata: 'CDG', name: 'Paris Charles de Gaulle',    city: 'Paris',          country: 'France',          terminal: 'Terminal 2',      inSchengen: true  },
  { iata: 'FCO', name: 'Rome Fiumicino',             city: 'Rome',           country: 'Italy',           terminal: 'Terminal 3',      inSchengen: true  },
  { iata: 'FRA', name: 'Frankfurt Airport',          city: 'Frankfurt',      country: 'Germany',         terminal: 'Terminal 1',      inSchengen: true  },
  { iata: 'MAD', name: 'Madrid Barajas',             city: 'Madrid',         country: 'Spain',           terminal: 'Terminal 4',      inSchengen: true  },
  { iata: 'MUC', name: 'Munich Airport',             city: 'Munich',         country: 'Germany',         terminal: 'Terminal 2',      inSchengen: true  },
  { iata: 'VCE', name: 'Venice Marco Polo',          city: 'Venice',         country: 'Italy',           terminal: 'Main Terminal',   inSchengen: true  },
  { iata: 'ZRH', name: 'Zurich Airport',             city: 'Zurich',         country: 'Switzerland',     terminal: 'Airside Center',  inSchengen: true  },
  // Europe — non-Schengen
  { iata: 'IST', name: 'Istanbul Airport',           city: 'Istanbul',       country: 'Turkey',          terminal: 'Main Terminal',   inSchengen: false },
  { iata: 'LHR', name: 'London Heathrow',            city: 'London',         country: 'United Kingdom',  terminal: 'Terminals 2–5',   inSchengen: false },
  // Middle East
  { iata: 'DOH', name: 'Hamad International',        city: 'Doha',           country: 'Qatar',           terminal: 'Main Terminal',   inSchengen: false },
  { iata: 'DXB', name: 'Dubai International',        city: 'Dubai',          country: 'UAE',             terminal: 'Terminal 3',      inSchengen: false },
  // Asia-Pacific
  { iata: 'BKK', name: 'Bangkok Suvarnabhumi',       city: 'Bangkok',        country: 'Thailand',        terminal: 'Main Terminal',   inSchengen: false },
  { iata: 'HKG', name: 'Hong Kong International',    city: 'Hong Kong',      country: 'China',           terminal: 'Terminal 1',      inSchengen: false },
  { iata: 'ICN', name: 'Seoul Incheon',              city: 'Seoul',          country: 'South Korea',     terminal: 'Terminal 1',      inSchengen: false },
  { iata: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur',   country: 'Malaysia',        terminal: 'KLIA Main',       inSchengen: false },
  { iata: 'NRT', name: 'Tokyo Narita',               city: 'Tokyo',          country: 'Japan',           terminal: 'Terminal 1',      inSchengen: false },
  { iata: 'PEK', name: 'Beijing Capital',            city: 'Beijing',        country: 'China',           terminal: 'Terminal 3',      inSchengen: false },
  { iata: 'PVG', name: 'Shanghai Pudong',            city: 'Shanghai',       country: 'China',           terminal: 'Terminal 2',      inSchengen: false },
  { iata: 'SIN', name: 'Singapore Changi',           city: 'Singapore',      country: 'Singapore',       terminal: 'Terminals 1–4',   inSchengen: false },
  { iata: 'SYD', name: 'Sydney Kingsford Smith',     city: 'Sydney',         country: 'Australia',       terminal: 'Terminal 1',      inSchengen: false },
  // North America
  { iata: 'JFK', name: 'New York JFK',               city: 'New York',       country: 'United States',   terminal: 'Terminals 1–8',   inSchengen: false },
  { iata: 'LAX', name: 'Los Angeles International',  city: 'Los Angeles',    country: 'United States',   terminal: 'TBIT / T4 / T7',  inSchengen: false },
  { iata: 'MIA', name: 'Miami International',        city: 'Miami',          country: 'United States',   terminal: 'North Terminal',  inSchengen: false },
  { iata: 'ORD', name: 'Chicago O\'Hare',            city: 'Chicago',        country: 'United States',   terminal: 'Terminals 1–3',   inSchengen: false },
  { iata: 'SFO', name: 'San Francisco International',city: 'San Francisco',  country: 'United States',   terminal: 'Intl Terminal',   inSchengen: false },
  { iata: 'YYZ', name: 'Toronto Pearson',            city: 'Toronto',        country: 'Canada',          terminal: 'Terminal 1',      inSchengen: false },
  // South America & Africa
  { iata: 'GRU', name: 'São Paulo Guarulhos',        city: 'São Paulo',      country: 'Brazil',          terminal: 'Terminal 3',      inSchengen: false },
  { iata: 'JNB', name: 'Johannesburg O.R. Tambo',    city: 'Johannesburg',   country: 'South Africa',    terminal: 'Terminal A/B',    inSchengen: false },
];

// Airlines that indicate a home airport for auto-detection
export const AIRLINE_HUB: Record<string, string> = {
  AY: 'HEL',
  BA: 'LHR',
  CX: 'HKG', KA: 'HKG',
  KL: 'AMS', MP: 'AMS',
  SK: 'ARN', WF: 'ARN',
  LH: 'FRA', LX: 'ZRH', OS: 'VIE',
  AF: 'CDG',
  IB: 'MAD',
  AZ: 'FCO', IT: 'FCO',
  TK: 'IST',
  EK: 'DXB',
  QR: 'DOH',
  SQ: 'SIN', MI: 'SIN',
  TG: 'BKK',
  MH: 'KUL',
  NH: 'NRT',
  JL: 'NRT',
  KE: 'ICN',
  OZ: 'ICN',
  CA: 'PEK',
  MU: 'PVG', FM: 'PVG',
  QF: 'SYD',
  UA: 'ORD',
  AA: 'MIA',
  DL: 'JFK',
  AC: 'YYZ',
  LA: 'GRU',
  SA: 'JNB',
};
