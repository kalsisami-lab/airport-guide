import { buildPassengerContext, buildStatusContext } from '../normalization/normalize';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import { findAirportServices } from '../airport-services/findAirportServices';
import { ALL_SERVICE_TYPES } from '../airport-services/types';
import type {
  AirportEntitlements,
  FastTrackResult,
  FlightRequest,
  LoungeEntitlement,
  LoungeInputWithMeta,
  PriorityBoardingResult,
  Repos,
  UserInput,
} from './types';
import { STATUS_SORT as SORT_MAP } from './types';
import type { AccessResult, EvalOptions } from '../engine/types';
import type { ServiceType } from '../airport-services/types';

// Converts an AccessResult to the legacy boolean-result shape still used by the UI.
function toAvailableResult(r: AccessResult): FastTrackResult {
  return {
    available:  r.status === 'allowed' || r.status === 'likely_allowed',
    confidence: r.confidence,
    reason:     r.reason,
    source:     r.source,
  };
}

export function findEntitlementsAtAirport(
  user: UserInput,
  flight: FlightRequest,
  repos: Repos,
  opts?: { now?: Date },
): AirportEntitlements {
  const now = opts?.now ?? new Date();

  // ── Build contexts ─────────────────────────────────────────────────────────
  // Single DB lookup for arrival airport — country_code + isSchengen from same row.
  // Unknown IATA → arrivalCountryCode stays unset → arrivalIsSchengen = null → no zone filter.
  const arrivalInfo    = repos.airport.getAirportInfo(flight.arrivalAirport);
  const enrichedFlight = arrivalInfo ? { ...flight, arrivalCountryCode: arrivalInfo.countryCode } : flight;
  const passenger = buildPassengerContext(enrichedFlight, repos.airlines);
  const status    = buildStatusContext(user.statusCards, passenger.operatingAlliance, repos.tiers);

  // ── Evaluate lounges ───────────────────────────────────────────────────────
  const loungeInputs = repos.airport.getLoungesAtAirport(flight.departureAirport) as LoungeInputWithMeta[];

  const evalOpts: EvalOptions = {
    now,
    passengerTerminalId: flight.departureTerminalId,
    passengerCards:      user.cards,
  };

  const lounges: LoungeEntitlement[] = loungeInputs
    .map((lounge) => ({
      lounge: {
        id:                  lounge.id,
        name:                lounge.name,
        terminalId:          lounge.terminalId,
        openingHours:        lounge.openingHours,
        tier:                lounge.tier,
        loungeClass:         lounge.loungeClass,
        area:                (lounge as LoungeInputWithMeta).area ?? 'all',
        locationDescription: lounge.locationDescription,
        amenities:           lounge.amenities,
      },
      access: evaluateLoungeAccess(passenger, status, lounge, evalOpts),
    }))
    .sort((a, b) => {
      const d = SORT_MAP[a.access.status] - SORT_MAP[b.access.status];
      if (d !== 0) return d;
      return b.access.confidence - a.access.confidence;
    });

  // ── Evaluate airport services (new engine) ─────────────────────────────────
  const rulesMap = Object.fromEntries(
    ALL_SERVICE_TYPES.map((svc) => [
      svc,
      repos.airport.getAirportServiceRules(flight.departureAirport, svc),
    ]),
  ) as Record<ServiceType, ReturnType<typeof repos.airport.getAirportServiceRules>>;

  const fastTrackCards = new Set<string>(user.fastTrackCards ?? []);
  const airportServices = findAirportServices(passenger, status, flight.departureAirport, rulesMap, now, fastTrackCards);

  // ── Backward-compatible derived fields for the existing UI ─────────────────
  const fastTrack:        FastTrackResult        = toAvailableResult(airportServices.services.fast_track_security);
  const priorityBoarding: PriorityBoardingResult = toAvailableResult(airportServices.services.priority_boarding);

  return {
    passenger,
    status,
    lounges,
    services:         airportServices.services,
    fastTrack,
    priorityBoarding,
    evaluatedAt:      now.toISOString(),
  };
}
