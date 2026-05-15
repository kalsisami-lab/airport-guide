export type Airport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  terminal: string;
  inSchengen: boolean;
};

export const airports: Airport[] = [
  { iata: 'HEL', name: 'Helsinki-Vantaa',           city: 'Helsinki',  country: 'Finland',         terminal: 'Terminal 2',         inSchengen: true  },
  { iata: 'LHR', name: 'London Heathrow',            city: 'London',    country: 'United Kingdom',  terminal: 'Terminals 2–5',      inSchengen: false },
  { iata: 'AMS', name: 'Amsterdam Schiphol',         city: 'Amsterdam', country: 'Netherlands',     terminal: 'Main Terminal',      inSchengen: true  },
  { iata: 'ARN', name: 'Stockholm Arlanda',          city: 'Stockholm', country: 'Sweden',          terminal: 'Terminal 5',         inSchengen: true  },
  { iata: 'FRA', name: 'Frankfurt Airport',          city: 'Frankfurt', country: 'Germany',         terminal: 'Terminal 1',         inSchengen: true  },
  { iata: 'CDG', name: 'Paris Charles de Gaulle',    city: 'Paris',     country: 'France',          terminal: 'Terminal 2',         inSchengen: true  },
  { iata: 'VCE', name: 'Venice Marco Polo',          city: 'Venice',    country: 'Italy',           terminal: 'Main Terminal',       inSchengen: true  },
  { iata: 'HKG', name: 'Hong Kong International',    city: 'Hong Kong', country: 'China',           terminal: 'Terminal 1',          inSchengen: false },
];

// Airlines that indicate a home airport for auto-detection
export const AIRLINE_HUB: Record<string, string> = {
  AY: 'HEL',
  BA: 'LHR', IB: 'LHR',
  CX: 'HKG', KA: 'HKG',
  KL: 'AMS', DL: 'AMS',
  SK: 'ARN', WF: 'ARN',
  LH: 'FRA', LX: 'FRA', OS: 'FRA',
  AF: 'CDG',
};
