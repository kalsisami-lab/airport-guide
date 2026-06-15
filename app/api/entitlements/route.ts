// Experimental entitlement engine — kokeilu-branch only.
// The original /api/lounges is untouched and remains the production path.
import { NextRequest, NextResponse } from 'next/server';
import { findEntitlementsAtAirport } from '@/lib/entitlements/findEntitlementsAtAirport';
import { createAirlineRepository, createTierRepository } from '@/lib/normalization/repository';
import { createAirportRepository } from '@/lib/entitlements/repository';
import type { FlightRequest, UserInput } from '@/lib/entitlements/types';
import type { ChannelType } from '@/lib/engine/types';

// Repositories are initialised lazily on the first request (not at module evaluation)
// so that Next.js's build-time "Collecting page data" phase does not open the DB.
type Repos = { airlines: ReturnType<typeof createAirlineRepository>; tiers: ReturnType<typeof createTierRepository>; airport: ReturnType<typeof createAirportRepository> };
let _repos: Repos | null = null;
function getRepos(): Repos {
  if (!_repos) {
    _repos = {
      airlines: createAirlineRepository(),
      tiers:    createTierRepository(),
      airport:  createAirportRepository(),
    };
  }
  return _repos;
}

// ─── Request schema ───────────────────────────────────────────────────────────

interface EntitlementRequest {
  flight: {
    operatingCarrier:    string;
    marketingCarrier?:   string;
    cabin:               'first' | 'business' | 'economy';
    departureAirport:    string;
    arrivalAirport:      string;
    departureTerminalId?: number;
    departureTime?:       string;
    departureCountryCode?: string;
    sameDayDeparture?:   boolean;
    gate?:               string;
  };
  user: {
    statusCards: { programCode: string; tierName: string }[];
    cards?:      string[];
  };
}

function validateRequest(body: unknown): EntitlementRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  if (!b.flight || typeof b.flight !== 'object') return null;
  if (!b.user   || typeof b.user   !== 'object') return null;

  const f = b.flight as Record<string, unknown>;
  if (typeof f.operatingCarrier !== 'string') return null;
  if (typeof f.departureAirport !== 'string') return null;
  if (typeof f.arrivalAirport   !== 'string') return null;
  if (!['first', 'business', 'economy'].includes(f.cabin as string)) return null;

  const u = b.user as Record<string, unknown>;
  if (!Array.isArray(u.statusCards)) return null;

  return body as EntitlementRequest;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = validateRequest(body);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Required fields: flight.operatingCarrier, flight.departureAirport, flight.arrivalAirport, flight.cabin, user.statusCards' },
      { status: 422 },
    );
  }

  const flight: FlightRequest = {
    operatingCarrier:     parsed.flight.operatingCarrier.toUpperCase(),
    marketingCarrier:     parsed.flight.marketingCarrier?.toUpperCase(),
    cabin:                parsed.flight.cabin,
    departureAirport:     parsed.flight.departureAirport.toUpperCase(),
    arrivalAirport:       parsed.flight.arrivalAirport.toUpperCase(),
    departureTerminalId:  parsed.flight.departureTerminalId,
    departureTime:        parsed.flight.departureTime,
    departureCountryCode: parsed.flight.departureCountryCode?.toUpperCase(),
    sameDayDeparture:     parsed.flight.sameDayDeparture,
    gate:                 parsed.flight.gate,
  };

  const user: UserInput = {
    statusCards: parsed.user.statusCards,
    cards:       (parsed.user.cards ?? []) as ChannelType[],
  };

  try {
    const result = findEntitlementsAtAirport(user, flight, getRepos());
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/entitlements]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
