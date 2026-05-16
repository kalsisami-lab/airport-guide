// Lounge lookup API — reads exclusively from the local static database.
// No external API calls are made. Unsupported airports return an empty list.
import { NextRequest, NextResponse } from 'next/server';
import type { AILounge, AILoungeTier, LoungeNetwork } from '@/lib/aiLounge';
import { STATUS_ALLIANCE_TIER } from '@/data/allianceRules';
import { applyHardFilter } from '@/lib/loungeFilter';
import { LOUNGE_DATABASE, type StaticLounge } from '@/data/loungesData';

interface LoungeQuery {
  airportIata: string;
  departureZone?: 'schengen' | 'non-schengen' | 'international';
  operatingCarrierCode?: string | null;
  cardNetworks?: string[];
  statusName?: string;
  statusAccessMethods?: string[];
  gate?: string;
}

// ─── Walking time ──────────────────────────────────────────────────────────────

function computeWalkingInfo(gate: string | undefined, lounge: StaticLounge): string | undefined {
  if (!gate || !lounge.gateDistances) return undefined;
  const g = gate.toUpperCase();
  // Sort keys longest-first so "36" beats "3" for an exact-gate match
  const keys = Object.keys(lounge.gateDistances).sort((a, b) => b.length - a.length);
  const key = keys.find((k) => g.startsWith(k.toUpperCase()));
  if (!key) return undefined;
  return `~${lounge.gateDistances[key]} min from Gate ${gate}`;
}

// ─── Access-method label ───────────────────────────────────────────────────────

function accessMethodLabel(
  network: LoungeNetwork,
  statusAccessMethods: string[],
  statusName?: string,
): string {
  switch (network) {
    case 'oneworld': {
      const entry = statusAccessMethods
        .map((m) => STATUS_ALLIANCE_TIER[m])
        .find((e) => e?.alliance === 'oneworld');
      if (!entry) return 'oneworld status';
      return `oneworld ${entry.tier.charAt(0).toUpperCase()}${entry.tier.slice(1)}`;
    }
    case 'star-alliance': return 'Star Alliance Gold';
    case 'skyteam':       return 'SkyTeam Elite Plus';
    case 'priority-pass': return 'Priority Pass';
    case 'lounge-key':    return 'LoungeKey';
    case 'dragon-pass':   return 'DragonPass';
    case 'amex-centurion':return 'Amex Platinum';
    case 'airline-own':   return statusName ?? 'Airline status';
    case 'independent':   return 'Paid access';
    default:              return 'Access granted';
  }
}

// ─── Network resolution ────────────────────────────────────────────────────────

/**
 * Returns the first network in lounge.networks that the user actually qualifies
 * for, by running each candidate through the hard alliance filter.
 */
function resolveNetwork(
  lounge: StaticLounge,
  operatingCarrierCode: string | null,
  statusAccessMethods: string[],
  cardNetworks: string[],
): LoungeNetwork | null {
  for (const network of lounge.networks) {
    const candidate: AILounge = {
      id:           lounge.id,
      name:         lounge.name,
      location:     lounge.locationDescription,
      accessMethod: '',
      hours:        lounge.openingHours,
      amenities:    lounge.amenities,
      tier:         lounge.tier,
      network,
      loungeClass:  lounge.loungeClass,
    };
    const passed = applyHardFilter([candidate], {
      operatingCarrierCode,
      statusAccessMethods,
      cardNetworks,
    });
    if (passed.length > 0) return network;
  }
  return null;
}

// ─── Zone filter ───────────────────────────────────────────────────────────────

/**
 * Returns true if the lounge should be shown for the given departure zone.
 *
 * - 'all'           → always visible
 * - 'international' → visible in any zone (non-EU airports such as SIN have no split)
 * - zone='international' (unknown/no destination) → show all lounges (don't hide either side)
 * - otherwise       → lounge.area must match the zone exactly
 */
function matchesZone(
  loungeArea: StaticLounge['area'],
  zone: 'schengen' | 'non-schengen' | 'international',
): boolean {
  if (loungeArea === 'all')           return true;
  if (loungeArea === 'international') return true;  // e.g. SIN lounges visible from any zone
  if (zone === 'international')       return true;  // no destination known → show both sides
  return loungeArea === zone;
}

// ─── Main resolver ─────────────────────────────────────────────────────────────

function resolveStaticLounges(statics: StaticLounge[], q: LoungeQuery): AILounge[] {
  const zone          = q.departureZone ?? 'international';
  const carrierCode   = q.operatingCarrierCode ?? null;
  const statusMethods = q.statusAccessMethods  ?? [];
  const cardNetworks  = q.cardNetworks         ?? [];

  const results: AILounge[] = [];

  for (const lounge of statics) {
    if (!matchesZone(lounge.area, zone)) continue;

    const network = resolveNetwork(lounge, carrierCode, statusMethods, cardNetworks);
    if (!network) continue;

    results.push({
      id:           lounge.id,
      name:         lounge.name,
      location:     `${lounge.terminal} · ${lounge.locationDescription}`,
      accessMethod: accessMethodLabel(network, statusMethods, q.statusName),
      hours:        lounge.openingHours,
      amenities:    lounge.amenities,
      tier:         lounge.tier,
      network,
      loungeClass:  lounge.loungeClass,
      walkingInfo:  computeWalkingInfo(q.gate, lounge),
    });
  }

  // Sort: ultra-premium → premium → standard
  const order: Record<AILoungeTier, number> = { 'ultra-premium': 0, premium: 1, standard: 2 };
  return results.sort((a, b) => order[a.tier] - order[b.tier]);
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: LoungeQuery;
  try {
    body = await req.json() as LoungeQuery;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.airportIata) {
    return NextResponse.json({ error: 'airportIata is required' }, { status: 400 });
  }

  const iata = body.airportIata.toUpperCase();
  const staticData = LOUNGE_DATABASE[iata];

  if (!staticData) {
    // Airport not yet in database — return empty, never 500
    return NextResponse.json({
      lounges: [],
      notes: `${iata} is not yet in our lounge database.`,
    });
  }

  const lounges = resolveStaticLounges(staticData, body);
  return NextResponse.json({ lounges });
}
