import { NextRequest, NextResponse } from 'next/server';
import { isSchengenCountry } from '@/lib/airportCountryData';

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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ airports: [], source: 'local' });
  }

  const apiKey = req.headers.get('x-flight-api-key') ?? process.env.FLIGHT_API_KEY;

  if (apiKey) {
    try {
      const url = `https://api.aviationstack.com/v1/airports?access_key=${apiKey}&search=${encodeURIComponent(q)}&limit=12`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) {
        const json = await res.json() as AviationAirportsResponse;
        const airports = (json.data ?? [])
          .filter((r) => r.iata_code && r.iata_code.length === 3)
          .map((r) => ({
            iata: r.iata_code,
            name: r.airport_name,
            city: extractCity(r.airport_name),
            country: r.country_name,
            terminal: '',
            inSchengen: isSchengenCountry(r.country_iso2 ?? ''),
          }));
        return NextResponse.json({ airports, source: 'aviationstack' });
      }
    } catch (err) {
      console.error('Airport search failed:', err);
    }
  }

  return NextResponse.json({ airports: [], source: 'local' });
}
