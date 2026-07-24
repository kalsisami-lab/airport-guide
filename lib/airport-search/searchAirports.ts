import { db } from '../../db/client';
import { airports } from '../../db/schema';
import { like, or, sql } from 'drizzle-orm';
import type { Airport } from '../../data/airports';
import { isSchengenCountry } from '../airportCountryData';
import { countryNameFor } from './countryNames';

// Search the local `airports` table (129 rows in the current seed) by IATA
// prefix, name, or city. Returns rows in the frontend `Airport` shape so the
// existing dropdown consumes them without further mapping.
//
// This is intentionally a standalone function rather than a method on
// `AirportRepository`. Adding a required method to that interface would break
// seven existing test mocks; a separate module keeps the change surface small
// and lets `/api/airports` combine DB results with the (optional) upstream
// Aviationstack call in one place.

const DEFAULT_LIMIT = 12;

export function searchAirports(query: string, limit: number = DEFAULT_LIMIT): Airport[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const upperQ = q.toUpperCase();
  const pattern = `%${q}%`;

  const rows = db.select({
      iataCode:    airports.iataCode,
      name:        airports.name,
      city:        airports.city,
      countryCode: airports.countryCode,
    })
    .from(airports)
    .where(or(
      // IATA is exact 3 chars — use prefix match (typing "GZ" surfaces GZP).
      like(airports.iataCode, `${upperQ}%`),
      // Name and city: case-insensitive substring match. SQLite's LIKE is
      // case-insensitive by default for ASCII; for Unicode names (Tromsø,
      // Gazipaşa) the query the user types must match the row's casing.
      // Fine in practice — the dropdown sees both forms via IATA anyway.
      like(airports.name, pattern),
      like(airports.city, pattern),
    ))
    // IATA-prefix hits ranked ahead of name/city hits so typing "TRD" lands
    // TRD at the top even if another airport's name contains "trd".
    .orderBy(sql`case when ${airports.iataCode} like ${`${upperQ}%`} then 0 else 1 end`, airports.iataCode)
    .limit(limit)
    .all();

  return rows.map((r): Airport => ({
    iata:       r.iataCode,
    name:       r.name,
    city:       r.city,
    country:    countryNameFor(r.countryCode),
    terminal:   '',
    inSchengen: isSchengenCountry(r.countryCode),
  }));
}
