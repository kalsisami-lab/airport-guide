import type { LoungeArea } from './lounges';

export type PierCode = string;

export type PierConfig = {
  pier: PierCode;
  area: LoungeArea;
  min: number;
  max: number;
};

export type GateInfo = {
  number: number;
  pier: PierCode;
  area: LoungeArea;
};

export const piersByAirport: Record<string, PierConfig[]> = {
  HKG: [
    { pier: 'T1W', area: 'non-schengen', min: 1,  max: 35 },
    { pier: 'T1M', area: 'non-schengen', min: 36, max: 60 },
    { pier: 'T1E', area: 'non-schengen', min: 61, max: 87 },
  ],
  FRA: [
    { pier: 'A', area: 'schengen',     min: 1,   max: 49  },
    { pier: 'B', area: 'non-schengen', min: 50,  max: 99  },
    { pier: 'C', area: 'non-schengen', min: 100, max: 149 },
    { pier: 'Z', area: 'schengen',     min: 200, max: 260 }, // Terminal 2
  ],
  HEL: [
    { pier: 'B', area: 'schengen',     min: 11, max: 19 },
    { pier: 'C', area: 'schengen',     min: 20, max: 29 },
    { pier: 'D', area: 'non-schengen', min: 30, max: 49 },
    { pier: 'E', area: 'non-schengen', min: 50, max: 60 },
  ],
  LHR: [
    { pier: 'T2', area: 'non-schengen', min: 1,   max: 99  },
    { pier: 'T3', area: 'non-schengen', min: 100,  max: 199 },
    { pier: 'T4', area: 'non-schengen', min: 300,  max: 399 },
    { pier: 'T5', area: 'non-schengen', min: 500,  max: 599 },
  ],
  AMS: [
    { pier: 'D/F', area: 'schengen',     min: 1,  max: 49 },
    { pier: 'E',   area: 'non-schengen', min: 50, max: 99 },
  ],
  ARN: [
    { pier: 'T2', area: 'schengen',     min: 1,  max: 29 },
    { pier: 'E',  area: 'schengen',     min: 30, max: 59 },
    { pier: 'F',  area: 'non-schengen', min: 60, max: 89 },
  ],
};

// CDG halls: F, G, K → Schengen (Terminal 2F/2G); E, D, M, L → Non-Schengen (Terminal 2E)
const CDG_SCHENGEN_HALLS = new Set(['F', 'G', 'K']);

export function parseGate(input: string, airportIata: string): GateInfo | null {
  const cleaned = input.trim().toUpperCase();

  // CDG special case: gates like '2F30', '2G15', '2E12', '2D08'
  if (airportIata === 'CDG') {
    const m = cleaned.match(/^(\d)([A-Z])(\d+)$/);
    if (!m) return null;
    const hall = m[2];
    const num  = parseInt(m[3], 10);
    const pier = `${m[1]}${hall}`;
    const area: LoungeArea = CDG_SCHENGEN_HALLS.has(hall) ? 'schengen' : 'non-schengen';
    return { number: num, pier, area };
  }

  // Default: strip leading letters, parse trailing number
  const num = parseInt(cleaned.replace(/^[A-Z]+/, ''), 10);
  if (isNaN(num)) return null;
  const configs = piersByAirport[airportIata] ?? [];
  const range = configs.find((r) => num >= r.min && num <= r.max);
  if (!range) return null;
  return { number: num, pier: range.pier, area: range.area };
}

export function pierPosition(gate: GateInfo, airportIata: string): number {
  const configs = piersByAirport[airportIata] ?? [];
  const range = configs.find((r) => r.pier === gate.pier);
  if (!range) return 0;
  return (gate.number - range.min) / Math.max(1, range.max - range.min);
}
