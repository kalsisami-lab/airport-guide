import type { FlightInfo } from './flightLookup';

export type GlobalSearchResult = FlightInfo & {
  source: 'global-db' | 'ai';
  confidence: 'confirmed' | 'estimated';
};

// ── Extended airline hub registry ────────────────────────────────────────────
const AIRLINE_ORIGINS: Record<string, { iata: string; name: string; city: string }> = {
  AY: { iata: 'HEL', name: 'Helsinki-Vantaa',          city: 'Helsinki'    },
  BA: { iata: 'LHR', name: 'London Heathrow',           city: 'London'      },
  KL: { iata: 'AMS', name: 'Amsterdam Schiphol',        city: 'Amsterdam'   },
  SK: { iata: 'ARN', name: 'Stockholm Arlanda',         city: 'Stockholm'   },
  LH: { iata: 'FRA', name: 'Frankfurt Airport',         city: 'Frankfurt'   },
  TK: { iata: 'IST', name: 'Istanbul Airport',          city: 'Istanbul'    },
  EK: { iata: 'DXB', name: 'Dubai International',      city: 'Dubai'       },
  QR: { iata: 'DOH', name: 'Hamad International',       city: 'Doha'        },
  LX: { iata: 'ZRH', name: 'Zurich Airport',            city: 'Zurich'      },
  OS: { iata: 'VIE', name: 'Vienna International',      city: 'Vienna'      },
  AF: { iata: 'CDG', name: 'Paris Charles de Gaulle',   city: 'Paris'       },
  IB: { iata: 'MAD', name: 'Madrid Barajas',            city: 'Madrid'      },
  QF: { iata: 'SYD', name: 'Sydney Kingsford Smith',    city: 'Sydney'      },
  CX: { iata: 'HKG', name: 'Hong Kong International',   city: 'Hong Kong'   },
  JL: { iata: 'NRT', name: 'Tokyo Narita',              city: 'Tokyo'       },
  NH: { iata: 'NRT', name: 'Tokyo Narita',              city: 'Tokyo'       },
  SQ: { iata: 'SIN', name: 'Singapore Changi',          city: 'Singapore'   },
  TG: { iata: 'BKK', name: 'Suvarnabhumi Airport',      city: 'Bangkok'     },
  MH: { iata: 'KUL', name: 'Kuala Lumpur International',city: 'Kuala Lumpur'},
  AA: { iata: 'DFW', name: 'Dallas/Fort Worth',         city: 'Dallas'      },
  UA: { iata: 'EWR', name: 'Newark Liberty',            city: 'Newark'      },
  DL: { iata: 'ATL', name: 'Hartsfield-Jackson Atlanta',city: 'Atlanta'     },
  AC: { iata: 'YYZ', name: 'Toronto Pearson',           city: 'Toronto'     },
  EI: { iata: 'DUB', name: 'Dublin Airport',            city: 'Dublin'      },
  FR: { iata: 'STN', name: 'London Stansted',           city: 'London'      },
  U2: { iata: 'LGW', name: 'London Gatwick',            city: 'London'      },
};

// ── Extended route table (simulated global database) ─────────────────────────
const EXTENDED_ROUTES: Record<string, Omit<GlobalSearchResult, 'flightNumber'>> = {
  // Turkish Airlines (TK)
  'TK1':    { airline: 'Turkish Airlines', source: 'global-db', confidence: 'confirmed', origin: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul' }, destination: { iata: 'JFK', city: 'New York JFK', country: 'United States', schengen: false }, departureTime: '11:00', arrivalTime: '14:30', aircraft: 'B777-300ER' },
  'TK3':    { airline: 'Turkish Airlines', source: 'global-db', confidence: 'confirmed', origin: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul' }, destination: { iata: 'LHR', city: 'London Heathrow', country: 'United Kingdom', schengen: false }, departureTime: '08:00', arrivalTime: '10:00', aircraft: 'B787-9' },
  'TK13':   { airline: 'Turkish Airlines', source: 'global-db', confidence: 'confirmed', origin: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul' }, destination: { iata: 'LAX', city: 'Los Angeles', country: 'United States', schengen: false }, departureTime: '14:00', arrivalTime: '18:30', aircraft: 'B777-300ER' },
  'TK55':   { airline: 'Turkish Airlines', source: 'global-db', confidence: 'confirmed', origin: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul' }, destination: { iata: 'NRT', city: 'Tokyo Narita', country: 'Japan', schengen: false }, departureTime: '01:20', arrivalTime: '17:15', aircraft: 'B787-9' },
  'TK791':  { airline: 'Turkish Airlines', source: 'global-db', confidence: 'confirmed', origin: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul' }, destination: { iata: 'HEL', city: 'Helsinki', country: 'Finland', schengen: true }, departureTime: '10:45', arrivalTime: '13:10', aircraft: 'A321' },
  'TK1793': { airline: 'Turkish Airlines', source: 'global-db', confidence: 'confirmed', origin: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul' }, destination: { iata: 'ARN', city: 'Stockholm', country: 'Sweden', schengen: true }, departureTime: '09:35', arrivalTime: '12:15', aircraft: 'A320' },

  // Emirates (EK)
  'EK1':    { airline: 'Emirates', source: 'global-db', confidence: 'confirmed', origin: { iata: 'DXB', name: 'Dubai International', city: 'Dubai' }, destination: { iata: 'LHR', city: 'London Heathrow', country: 'United Kingdom', schengen: false }, departureTime: '08:30', arrivalTime: '12:45', aircraft: 'A380-800' },
  'EK3':    { airline: 'Emirates', source: 'global-db', confidence: 'confirmed', origin: { iata: 'DXB', name: 'Dubai International', city: 'Dubai' }, destination: { iata: 'LHR', city: 'London Heathrow', country: 'United Kingdom', schengen: false }, departureTime: '14:30', arrivalTime: '18:45', aircraft: 'B777-300ER' },
  'EK201':  { airline: 'Emirates', source: 'global-db', confidence: 'confirmed', origin: { iata: 'DXB', name: 'Dubai International', city: 'Dubai' }, destination: { iata: 'JFK', city: 'New York JFK', country: 'United States', schengen: false }, departureTime: '08:20', arrivalTime: '14:20', aircraft: 'A380-800' },
  'EK225':  { airline: 'Emirates', source: 'global-db', confidence: 'confirmed', origin: { iata: 'DXB', name: 'Dubai International', city: 'Dubai' }, destination: { iata: 'LAX', city: 'Los Angeles', country: 'United States', schengen: false }, departureTime: '09:00', arrivalTime: '14:25', aircraft: 'A380-800' },
  'EK105':  { airline: 'Emirates', source: 'global-db', confidence: 'confirmed', origin: { iata: 'DXB', name: 'Dubai International', city: 'Dubai' }, destination: { iata: 'SYD', city: 'Sydney', country: 'Australia', schengen: false }, departureTime: '21:55', arrivalTime: '17:10', aircraft: 'A380-800' },

  // Qatar Airways (QR)
  'QR1':    { airline: 'Qatar Airways', source: 'global-db', confidence: 'confirmed', origin: { iata: 'DOH', name: 'Hamad International', city: 'Doha' }, destination: { iata: 'LHR', city: 'London Heathrow', country: 'United Kingdom', schengen: false }, departureTime: '08:00', arrivalTime: '12:30', aircraft: 'B777-300ER' },
  'QR23':   { airline: 'Qatar Airways', source: 'global-db', confidence: 'confirmed', origin: { iata: 'DOH', name: 'Hamad International', city: 'Doha' }, destination: { iata: 'JFK', city: 'New York JFK', country: 'United States', schengen: false }, departureTime: '09:25', arrivalTime: '15:30', aircraft: 'B777-200LR' },
  'QR83':   { airline: 'Qatar Airways', source: 'global-db', confidence: 'confirmed', origin: { iata: 'DOH', name: 'Hamad International', city: 'Doha' }, destination: { iata: 'SIN', city: 'Singapore', country: 'Singapore', schengen: false }, departureTime: '02:40', arrivalTime: '15:30', aircraft: 'A350-900' },

  // Singapore Airlines (SQ)
  'SQ7':    { airline: 'Singapore Airlines', source: 'global-db', confidence: 'confirmed', origin: { iata: 'SIN', name: 'Singapore Changi', city: 'Singapore' }, destination: { iata: 'LHR', city: 'London Heathrow', country: 'United Kingdom', schengen: false }, departureTime: '23:59', arrivalTime: '05:55', aircraft: 'A350-900ULR' },
  'SQ25':   { airline: 'Singapore Airlines', source: 'global-db', confidence: 'confirmed', origin: { iata: 'SIN', name: 'Singapore Changi', city: 'Singapore' }, destination: { iata: 'JFK', city: 'New York JFK', country: 'United States', schengen: false }, departureTime: '23:35', arrivalTime: '06:20', aircraft: 'A350-900ULR' },

  // Air France (AF)
  'AF11':   { airline: 'Air France', source: 'global-db', confidence: 'confirmed', origin: { iata: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris' }, destination: { iata: 'JFK', city: 'New York JFK', country: 'United States', schengen: false }, departureTime: '10:30', arrivalTime: '12:45', aircraft: 'B777-300ER' },
  'AF447':  { airline: 'Air France', source: 'global-db', confidence: 'confirmed', origin: { iata: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris' }, destination: { iata: 'GRU', city: 'São Paulo', country: 'Brazil', schengen: false }, departureTime: '23:30', arrivalTime: '05:25', aircraft: 'A330-200' },
  'AF1631': { airline: 'Air France', source: 'global-db', confidence: 'confirmed', origin: { iata: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris' }, destination: { iata: 'HEL', city: 'Helsinki', country: 'Finland', schengen: true }, departureTime: '07:35', arrivalTime: '11:10', aircraft: 'A319' },

  // Swiss (LX)
  'LX16':   { airline: 'Swiss', source: 'global-db', confidence: 'confirmed', origin: { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich' }, destination: { iata: 'JFK', city: 'New York JFK', country: 'United States', schengen: false }, departureTime: '10:25', arrivalTime: '13:00', aircraft: 'B777-300ER' },
  'LX188':  { airline: 'Swiss', source: 'global-db', confidence: 'confirmed', origin: { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich' }, destination: { iata: 'SIN', city: 'Singapore', country: 'Singapore', schengen: false }, departureTime: '21:25', arrivalTime: '16:05', aircraft: 'A340-300' },

  // Qantas (QF)
  'QF1':    { airline: 'Qantas', source: 'global-db', confidence: 'confirmed', origin: { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney' }, destination: { iata: 'LHR', city: 'London Heathrow', country: 'United Kingdom', schengen: false }, departureTime: '16:00', arrivalTime: '05:00', aircraft: 'A380-800' },
  'QF7':    { airline: 'Qantas', source: 'global-db', confidence: 'confirmed', origin: { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney' }, destination: { iata: 'LAX', city: 'Los Angeles', country: 'United States', schengen: false }, departureTime: '23:00', arrivalTime: '18:00', aircraft: 'A380-800' },
};

// ── Heuristic fallback ────────────────────────────────────────────────────────
const INTERCONTINENTAL_POOL = [
  { iata: 'JFK', city: 'New York JFK',   country: 'United States',  schengen: false },
  { iata: 'LAX', city: 'Los Angeles',    country: 'United States',  schengen: false },
  { iata: 'DXB', city: 'Dubai',          country: 'UAE',            schengen: false },
  { iata: 'SIN', city: 'Singapore',      country: 'Singapore',      schengen: false },
  { iata: 'HKG', city: 'Hong Kong',      country: 'Hong Kong',      schengen: false },
  { iata: 'NRT', city: 'Tokyo Narita',   country: 'Japan',          schengen: false },
  { iata: 'BKK', city: 'Bangkok',        country: 'Thailand',       schengen: false },
];

const EUROPEAN_POOL = [
  { iata: 'LHR', city: 'London Heathrow', country: 'United Kingdom', schengen: false },
  { iata: 'CDG', city: 'Paris CDG',       country: 'France',         schengen: true  },
  { iata: 'AMS', city: 'Amsterdam',       country: 'Netherlands',    schengen: true  },
  { iata: 'FRA', city: 'Frankfurt',       country: 'Germany',        schengen: true  },
  { iata: 'MAD', city: 'Madrid',          country: 'Spain',          schengen: true  },
  { iata: 'FCO', city: 'Rome',            country: 'Italy',          schengen: true  },
  { iata: 'BCN', city: 'Barcelona',       country: 'Spain',          schengen: true  },
  { iata: 'VIE', city: 'Vienna',          country: 'Austria',        schengen: true  },
  { iata: 'ZRH', city: 'Zurich',          country: 'Switzerland',    schengen: true  },
];

const AIRCRAFT_BY_ROUTE = ['A320', 'A321', 'B737-800', 'A319', 'B787-9', 'A330-300'];

function heuristicEstimate(flightNumber: string): GlobalSearchResult | null {
  const code = flightNumber.replace(/\d.*$/, '').toUpperCase();
  const num  = parseInt(flightNumber.replace(/^\D+/, ''), 10);
  const origin = AIRLINE_ORIGINS[code];
  if (!origin || isNaN(num)) return null;

  // Low numbers → intercontinental; high numbers → regional
  const isRegional = num > 500;
  const pool = isRegional ? EUROPEAN_POOL : INTERCONTINENTAL_POOL;
  const dest = pool[num % pool.length];

  const hour = 6 + (num % 14);
  const dep  = `${String(hour).padStart(2, '0')}:${num % 2 === 0 ? '00' : '30'}`;
  const aircraft = AIRCRAFT_BY_ROUTE[num % AIRCRAFT_BY_ROUTE.length];
  const arr  = `${String((hour + 2 + (isRegional ? 0 : 6)) % 24).padStart(2, '0')}:00`;

  return {
    flightNumber,
    airline: code,
    source: 'global-db',
    confidence: 'estimated',
    origin,
    destination: dest,
    departureTime: dep,
    arrivalTime: arr,
    aircraft,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
// Priority: real API (when FLIGHT_API_KEY is set server-side) → extended mock routes → heuristic estimate.
// The /api/flight route handles the real API call to keep the key server-side.
export async function searchGlobalFlight(flightNumber: string, apiKey?: string | null): Promise<GlobalSearchResult | null> {
  const key = flightNumber.trim().toUpperCase();

  // 1. Try real API via server route — pass client key as header so it never appears in URL
  try {
    const headers: HeadersInit = {};
    // '__server__' means the server has the key in env — don't forward as header
    if (apiKey && apiKey !== '__server__') headers['x-flight-api-key'] = apiKey;
    const res = await fetch(`/api/flight?flight=${encodeURIComponent(key)}`, { headers });
    if (res.ok) {
      const data = await res.json() as { result: GlobalSearchResult | null; source: string };
      if (data.result) return data.result;
    }
  } catch {
    // network error — fall through to local data
  }

  // 2. Extended local mock database
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
  const exact = EXTENDED_ROUTES[key];
  if (exact) return { flightNumber: key, ...exact };

  // 3. Heuristic fallback
  return heuristicEstimate(key);
}
