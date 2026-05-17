import { buildPassengerContext, buildStatusContext } from '../normalization/normalize';
import { evaluateLoungeAccess } from '../engine/evaluateLoungeAccess';
import { evaluateFastTrack } from './fastTrack';
import { evaluatePriorityBoarding } from './priorityBoarding';
import type {
  AirportEntitlements,
  FlightRequest,
  LoungeEntitlement,
  LoungeInputWithMeta,
  Repos,
  STATUS_SORT,
  UserInput,
} from './types';
import { STATUS_SORT as SORT_MAP } from './types';
import type { EvalOptions } from '../engine/types';

export function findEntitlementsAtAirport(
  user: UserInput,
  flight: FlightRequest,
  repos: Repos,
  opts?: { now?: Date },
): AirportEntitlements {
  const now = opts?.now ?? new Date();

  // ── Phase 2: build contexts ─────────────────────────────────────────────────
  const passenger = buildPassengerContext(flight, repos.airlines);
  const status    = buildStatusContext(user.statusCards, passenger.operatingAlliance, repos.tiers);

  // ── Fetch lounges from airport repository ───────────────────────────────────
  const loungeInputs = repos.airport.getLoungesAtAirport(flight.departureAirport) as LoungeInputWithMeta[];

  // ── Phase 3: evaluate each lounge ───────────────────────────────────────────
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
        locationDescription: lounge.locationDescription,
        amenities:           lounge.amenities,
      },
      access: evaluateLoungeAccess(passenger, status, lounge, evalOpts),
    }))
    .sort((a, b) => {
      // Primary: status priority
      const d = SORT_MAP[a.access.status] - SORT_MAP[b.access.status];
      if (d !== 0) return d;
      // Secondary: confidence DESC (more certain results first)
      return b.access.confidence - a.access.confidence;
    });

  // ── Fast track + priority boarding (separate engines, same pass) ─────────────
  const ftRules  = repos.airport.getFastTrackRules(flight.departureAirport);
  const fastTrack = evaluateFastTrack(passenger, status, ftRules, now);

  const pbRules = repos.airport.getPriorityBoardingRules(flight.departureAirport);
  const priorityBoarding = evaluatePriorityBoarding(passenger, status, pbRules, now);

  return {
    passenger,
    status,
    lounges,
    fastTrack,
    priorityBoarding,
    evaluatedAt: now.toISOString(),
  };
}
