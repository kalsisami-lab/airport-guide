import { NextRequest, NextResponse } from 'next/server';
import type { GlobalSearchResult } from '@/lib/globalFlightSearch';
import { AIRPORT_META } from '@/lib/airportCountryData';

// ── Aviationstack response shape (subset) ────────────────────────────────────
interface AviationFlightRow {
  flight:    { iata?: string };
  airline:   { name?: string };
  departure: { iata?: string; airport?: string; scheduled?: string };
  arrival:   { iata?: string; airport?: string; scheduled?: string };
  aircraft:  { iata?: string } | null;
}
interface AviationResponse { data?: AviationFlightRow[] }

function formatTime(iso?: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function mapAviationRow(row: AviationFlightRow, flightNumber: string): GlobalSearchResult | null {
  const depIata = row.departure.iata;
  const arrIata = row.arrival.iata;
  if (!depIata || !arrIata) return null;
  const depMeta = AIRPORT_META[depIata];
  const arrMeta = AIRPORT_META[arrIata];
  return {
    flightNumber,
    airline:       row.airline.name ?? 'Unknown',
    source:        'global-db',
    confidence:    'confirmed',
    origin: {
      iata: depIata,
      name: row.departure.airport ?? depMeta?.city ?? depIata,
      city: depMeta?.city ?? row.departure.airport ?? depIata,
    },
    destination: {
      iata:     arrIata,
      city:     arrMeta?.city ?? row.arrival.airport ?? arrIata,
      country:  arrMeta?.country ?? 'Unknown',
      schengen: arrMeta?.inSchengen ?? false,
    },
    departureTime: formatTime(row.departure.scheduled),
    arrivalTime:   formatTime(row.arrival.scheduled),
    aircraft:      row.aircraft?.iata ?? 'Unknown',
  };
}

export async function GET(req: NextRequest) {
  const flight = req.nextUrl.searchParams.get('flight')?.toUpperCase().trim();
  if (!flight) {
    return NextResponse.json({ error: 'Missing flight parameter' }, { status: 400 });
  }

  // Client-supplied key (from localStorage settings) takes precedence over env var
  const apiKey = req.headers.get('x-flight-api-key') ?? process.env.FLIGHT_API_KEY;

  if (apiKey) {
    try {
      // Fetch up to 5 records — the API may return multiple dates; pick the one closest to now
      const url = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flight}&limit=5`;
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (res.ok) {
        const json = await res.json() as AviationResponse;
        const rows = (json.data ?? []).filter((r) => r.departure?.iata && r.arrival?.iata);

        // Sort rows by how close their scheduled departure is to right now; pick the nearest
        const now = Date.now();
        const sorted = rows
          .map((r) => ({ r, delta: Math.abs(new Date(r.departure.scheduled ?? 0).getTime() - now) }))
          .sort((a, b) => a.delta - b.delta);

        const best = sorted[0]?.r ?? rows[0];
        if (best) {
          const result = mapAviationRow(best, flight);
          if (result) return NextResponse.json({ result, source: 'aviationstack' });
        }
      }
    } catch (err) {
      console.error('Aviationstack fetch failed:', err);
    }
  }

  // No key or API call failed — signal caller to use local data
  return NextResponse.json({ result: null, source: 'local' });
}
