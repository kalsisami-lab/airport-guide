import type { AllianceTier } from '../normalization/types';
import type { AccessResult, AccessStatus, ChannelType, Condition, LoungeInput } from '../engine/types';
import type { PassengerContext, StatusContext, AirlineRepository, TierRepository, UserStatusCard } from '../normalization/types';
import type { AirportServiceRuleInput, ServiceType } from '../airport-services/types';

export type { PassengerContext, StatusContext };

// ─── Caller-facing input ──────────────────────────────────────────────────────

export interface UserInput {
  statusCards: UserStatusCard[];
  cards?: ChannelType[];          // Priority Pass, Amex Centurion, etc.
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
  sameDayDeparture?: boolean;
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

export interface AirportRepository {
  getLoungesAtAirport(iataCode: string): LoungeInput[];
  getAirportServiceRules(iataCode: string, serviceType: ServiceType): AirportServiceRuleInput[];
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
  not_enough_info:        4,
  denied:                 5,
  closed:                 6,
  not_offered_at_airport: 7,
  not_applicable:         8,
};

// Enrich LoungeInput with display fields needed in the output.
export interface LoungeMeta {
  tier:                string;
  loungeClass:         string;
  locationDescription: string | null;
  amenities:           string[] | null;
}

export type LoungeInputWithMeta = LoungeInput & LoungeMeta;
