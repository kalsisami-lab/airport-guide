import type { AllianceTier } from '../normalization/types';
import type { AccessResult, AccessStatus, ChannelType, Condition, LoungeInput } from '../engine/types';
import type { PassengerContext, StatusContext, AirlineRepository, TierRepository, UserStatusCard } from '../normalization/types';
import type { AirportServiceRuleInput, ServiceType } from '../airport-services/types';

export type { PassengerContext, StatusContext };

// ─── Caller-facing input ──────────────────────────────────────────────────────

export interface UserInput {
  statusCards: UserStatusCard[];
  cards?: ChannelType[];          // Priority Pass, Amex Centurion, etc.
  fastTrackCards?: string[];      // provider keys for airport_service_rules.provider
}

// Extends FlightInput with terminal info needed for reachability checks.
export interface FlightRequest {
  operatingCarrier: string;
  marketingCarrier?: string;
  cabin: 'first' | 'business' | 'economy';
  departureAirport: string;       // IATA
  arrivalAirport: string;
  departureTerminalId?: number;   // for physically_unreachable check
  departureTime?: string;         // ISO 8601
  departureCountryCode?: string;
  arrivalCountryCode?: string;    // injected by findEntitlementsAtAirport from DB
  sameDayDeparture?: boolean;
  gate?: string;                  // departure gate — used for walking-time hints in UI
  // UI-provided zone hint. Only used when arrivalCountryCode cannot be resolved
  // (unknown IATA). See lib/engine/evaluateLoungeAccess.ts for precedence.
  passengerZone?: 'schengen' | 'non_schengen';
}

// ─── Fast track ───────────────────────────────────────────────────────────────

export interface FastTrackRuleInput {
  id: number;
  priority: number;
  validFrom: string;
  validTo: string | null;
  confidence: number;
  minAllianceTier: AllianceTier | null;
  carrierRestriction: string[] | null;
  conditions: Condition | null;
}

export interface FastTrackResult {
  available: boolean;
  confidence: number;
  reason: string;
  source: string;
}

// ─── Priority boarding ────────────────────────────────────────────────────────

// Reuses the same rule shape as fast track — both are airport-level services.
export type PriorityBoardingRuleInput = FastTrackRuleInput;

export interface PriorityBoardingResult {
  available: boolean;
  confidence: number;
  reason: string;
  source: string;
}

// Re-export for external consumers (e.g. test helpers).
export type { AirportServiceRuleInput, ServiceType };

// ─── Repository interface ─────────────────────────────────────────────────────

export interface AirportInfo {
  countryCode: string;   // ISO 3166-1 alpha-2
  isSchengen:  boolean;
}

export interface AirportRepository {
  getLoungesAtAirport(iataCode: string): LoungeInput[];
  getAirportServiceRules(iataCode: string, serviceType: ServiceType): AirportServiceRuleInput[];
  /** Single DB lookup — countryCode and isSchengen from the same row. Returns null if IATA unknown. */
  getAirportInfo(iataCode: string): AirportInfo | null;
}

export interface Repos {
  airlines: AirlineRepository;
  tiers:    TierRepository;
  airport:  AirportRepository;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface LoungeEntitlement {
  lounge: {
    id:                  number;
    name:                string;
    terminalId:          number | null;
    openingHours:        string | null;
    tier:                string;
    loungeClass:         string;
    area:                string;   // 'schengen' | 'non_schengen' | 'international' | 'all'
    locationDescription: string | null;
    amenities:           string[] | null;
  };
  access: AccessResult;
}

export interface AirportEntitlements {
  passenger:        PassengerContext;
  status:           StatusContext | null;
  lounges:          LoungeEntitlement[];
  services:         Record<ServiceType, AccessResult>;
  // Backward-compatible fields derived from services — will be removed when UI is updated.
  fastTrack:        FastTrackResult;
  priorityBoarding: PriorityBoardingResult;
  evaluatedAt:      string;       // ISO timestamp
}

// Sort weight — lower = shown first.
export const STATUS_SORT: Record<AccessStatus, number> = {
  allowed:                0,
  likely_allowed:         1,
  paid_available:         2,
  physically_unreachable: 3,
  closed:                 4,
  denied:                 5,
  not_enough_info:        6,
  not_offered_at_airport: 7,
  not_applicable:         8,
};

// Enrich LoungeInput with display fields needed in the output.
export interface LoungeMeta {
  tier:                string;
  loungeClass:         string;
  area:                string;   // 'schengen' | 'non_schengen' | 'international' | 'all'
  locationDescription: string | null;
  amenities:           string[] | null;
}

export type LoungeInputWithMeta = LoungeInput & LoungeMeta;
