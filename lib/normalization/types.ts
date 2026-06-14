export type AllianceTier =
  | 'oneworld_emerald'
  | 'oneworld_sapphire'
  | 'oneworld_ruby'
  | 'star_gold'
  | 'star_silver'
  | 'skyteam_elite_plus'
  | 'skyteam_elite'
  | 'none';

export type AllianceCode = 'oneworld' | 'star_alliance' | 'skyteam' | null;

export interface FlightInput {
  operatingCarrier: string;
  marketingCarrier?: string;
  cabin: 'first' | 'business' | 'economy';
  departureAirport: string;
  arrivalAirport: string;
  departureTime?: string;         // ISO 8601
  departureCountryCode?: string;  // ISO 3166-1 alpha-2
  arrivalCountryCode?: string;    // ISO 3166-1 alpha-2 — used for Schengen zone routing
  sameDayDeparture?: boolean;
}

export interface UserStatusCard {
  programCode: string;  // FFP code e.g. 'ay-plus'
  tierName: string;     // tier name e.g. 'Gold'
}

export interface PassengerContext {
  operatingCarrier: string;
  marketingCarrier: string;
  operatingAlliance: AllianceCode;
  cabin: 'first' | 'business' | 'economy';
  departureAirport: string;
  arrivalAirport: string;
  sameDayDeparture: boolean;
  departureCountryCode: string;
  departureTime?: string;         // ISO 8601 — used for not_applicable checks
  arrivalCountryCode?: string;    // ISO 3166-1 alpha-2
  arrivalIsSchengen?: boolean | null;  // null = destination country unknown → skip zone check
}

export interface StatusContext {
  allianceTier: AllianceTier;
  programCode: string;
  tierName: string;
  fastTrack: boolean;
}

// Repository interfaces — implemented by DB layer; replaced by mocks in tests.
export interface AirlineRepository {
  getAllianceForCarrier(iataCode: string): AllianceCode;
}

export interface TierRepository {
  getTierForCard(
    programCode: string,
    tierName: string,
  ): { allianceTier: AllianceTier; fastTrack: boolean } | null;
}
