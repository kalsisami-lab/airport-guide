import type { AllianceTier } from '../normalization/types';
import type { AccessResult, Condition } from '../engine/types';

export type ServiceType =
  | 'fast_track_security'
  | 'priority_checkin'
  | 'priority_boarding'
  | 'priority_baggage';

export const ALL_SERVICE_TYPES: ServiceType[] = [
  'fast_track_security',
  'priority_checkin',
  'priority_boarding',
  'priority_baggage',
];

export interface AirportServiceRuleInput {
  id: number;
  priority: number;
  validFrom: string;           // 'YYYY-MM-DD'
  validTo: string | null;
  confidence: number;
  action: 'allow' | 'deny';
  minAllianceTier: AllianceTier | null;
  carrierRestriction: string[] | null;
  conditions: Condition | null;
  provider: string | null;     // e.g. 'star_alliance_gold_track', 'paid'
  notes: string | null;        // shown in UI tooltip
}

export interface AirportServicesResult {
  airportIata: string;
  services: Record<ServiceType, AccessResult>;
}
