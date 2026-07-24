import { NextRequest, NextResponse } from 'next/server';
import { isSchengenCountry } from '@/lib/airportCountryData';
import { hasRealFlightKey } from '@/lib/flightApiKey';
import { searchAirports as searchLocalAirports } from '@/lib/airport-search/searchAirports';
import type { Airport } from '@/data/airports';

interface AviationAirportRow {
  airport_name: string;
  iata_code: string;
  country_name: string;
  country_iso2: string;
}

interface AviationAirportsResponse {
  data?: AviationAirportRow[];
}

function extractCity(airportName: string): string {
  return airportName
    .replace(/\s+(international airport|international|airport|intl\.?)$/i, '')
    .trim();
}

const RESULT_LIMIT = 12;

// Combined DB-first search. The local `airports` table (129 rows) is the
// primary source and is queried on every request, so demo-mode users still
// see results for the airports we know about (including the §67 coverage
// airports like GZP/TRD/BOO that were previously invisible in the UI).
// Aviationstack, if a real key is present, provides a secondary sweep for
// airports outside the local set. DB entries win on IATA collision because
// they carry our editorial data (coverage status, lounge seed, etc.).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ airports: [], source: 'local' });
  }

  const local = searchLocalAirports(q, RESULT_LIMIT);
  const seenIatas = new Set(local.map((a) => a.iata));

  // Same placeholder-guard as /api/flight (see lib/flightApiKey.ts).
  const rawKey = req.headers.get('x-flight-api-key') ?? process.env.FLIGHT_API_KEY;
  const apiKey = hasRealFlightKey(rawKey) ? rawKey : null;

  let remote: Airport[] = [];
  let remoteFailed = false;
  if (apiKey && local.length < RESULT_LIMIT) {
    try {
      const url = `https://api.aviationstack.com/v1/airports?access_key=${apiKey}&search=${encodeURIComponent(q)}&limit=12`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) {
        const json = await res.json() as AviationAirportsResponse;
        remote = (json.data ?? [])
          .filter((r) => r.iata_code && r.iata_code.length === 3 && !seenIatas.has(r.iata_code))
          .map((r): Airport => ({
            iata: r.iata_code,
            name: r.airport_name,
            city: extractCity(r.airport_name),
            country: r.country_name,
            terminal: '',
            inSchengen: isSchengenCountry(r.country_iso2 ?? ''),
          }));
      } else {
        remoteFailed = true;
      }
    } catch (err) {
      console.error('Airport search (aviationstack) failed:', err);
      remoteFailed = true;
    }
  }

  const combined = [...local, ...remote].slice(0, RESULT_LIMIT);
  const source =
    local.length > 0 && remote.length > 0 ? 'db+aviationstack'
    : remote.length > 0                    ? 'aviationstack'
    : local.length > 0                     ? 'db'
    : remoteFailed                         ? 'db-empty+remote-failed'
    :                                        'db-empty';

  return NextResponse.json({ airports: combined, source });
}
