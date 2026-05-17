import type {
  AllianceCode,
  AllianceTier,
  AirlineRepository,
  FlightInput,
  PassengerContext,
  StatusContext,
  TierRepository,
  UserStatusCard,
} from './types';

const ALLIANCE_TIER_PREFIX: Record<NonNullable<AllianceCode>, string> = {
  oneworld:      'oneworld_',
  star_alliance: 'star_',
  skyteam:       'skyteam_',
};

// Higher number = better tier.
const TIER_PRIORITY: Record<AllianceTier, number> = {
  oneworld_emerald:   4,
  oneworld_sapphire:  3,
  oneworld_ruby:      1,
  star_gold:          3,
  star_silver:        1,
  skyteam_elite_plus: 3,
  skyteam_elite:      1,
  none:               0,
};

export function buildPassengerContext(
  flight: FlightInput,
  repo: AirlineRepository,
): PassengerContext {
  return {
    operatingCarrier:     flight.operatingCarrier,
    marketingCarrier:     flight.marketingCarrier ?? flight.operatingCarrier,
    operatingAlliance:    repo.getAllianceForCarrier(flight.operatingCarrier),
    cabin:                flight.cabin,
    departureAirport:     flight.departureAirport,
    arrivalAirport:       flight.arrivalAirport,
    sameDayDeparture:     flight.sameDayDeparture ?? false,
    departureCountryCode: flight.departureCountryCode ?? '',
  };
}

export function buildStatusContext(
  cards: UserStatusCard[],
  flightAlliance: AllianceCode,
  repo: TierRepository,
): StatusContext | null {
  if (cards.length === 0) return null;

  // Resolve each card to its DB tier; silently drop unknown cards.
  const resolved = cards.flatMap((card) => {
    const entry = repo.getTierForCard(card.programCode, card.tierName);
    if (!entry) return [];
    return [{ card, allianceTier: entry.allianceTier, fastTrack: entry.fastTrack }];
  });

  if (resolved.length === 0) return null;

  // Prefer cards whose tier belongs to the flight's alliance.
  const prefix = flightAlliance ? ALLIANCE_TIER_PREFIX[flightAlliance] : null;
  const allianceMatching = prefix
    ? resolved.filter((r) => r.allianceTier.startsWith(prefix))
    : [];

  // Fall back to all resolved cards when none match the alliance.
  const candidates = allianceMatching.length > 0 ? allianceMatching : resolved;

  const best = candidates.reduce((a, b) =>
    TIER_PRIORITY[b.allianceTier] > TIER_PRIORITY[a.allianceTier] ? b : a,
  );

  return {
    allianceTier: best.allianceTier,
    programCode:  best.card.programCode,
    tierName:     best.card.tierName,
    fastTrack:    best.fastTrack,
  };
}
