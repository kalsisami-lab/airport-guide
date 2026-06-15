import type { AllianceTier } from '../normalization/types';

export type AccessStatus =
  | 'allowed'
  | 'likely_allowed'
  | 'denied'
  | 'not_enough_info'
  | 'physically_unreachable'
  | 'paid_available'
  | 'closed'
  // Airport-service-specific: service not offered here / not relevant to this trip
  | 'not_offered_at_airport'
  | 'not_applicable';

export type ChannelType =
  | 'alliance_status'
  | 'airline_own'
  | 'priority_pass'
  | 'lounge_key'
  | 'dragon_pass'
  | 'amex_centurion'
  | 'op_card'
  | 'paid'
  | 'invitation';

export type ExceptionType = 'override' | 'blackout' | 'additional_requirement';

// ─── Predicate tree (whitelist of operators — no eval, no dynamic code) ────────

export type Condition =
  | { op: 'equals';             field: string;      value: unknown }
  | { op: 'in';                 field: string;      values: unknown[] }
  | { op: 'min_tier';           value: AllianceTier }
  | { op: 'same_day_departure'; value: boolean }
  | { op: 'country_equals';     value: string }
  | { op: 'not';                condition: Condition }
  | { op: 'and';                conditions: Condition[] }
  | { op: 'or';                 conditions: Condition[] };

// ─── Lounge input (pre-fetched from DB, or mocked in tests) ───────────────────

export interface RuleInput {
  id: number;
  priority: number;
  validFrom: string;              // 'YYYY-MM-DD'
  validTo: string | null;
  confidence: number;
  minAllianceTier: AllianceTier | null;
  carrierRestriction: string[] | null;
  conditions: Condition | null;
}

export interface ChannelInput {
  id: number;
  channelType: ChannelType;
  allianceAccess: 'all_alliance' | 'carrier_specific' | null;
  rules: RuleInput[];
}

export interface ExceptionInput {
  id: number;
  exceptionType: ExceptionType;
  priority: number;
  validFrom: string;
  validTo: string | null;
  confidence: number;
  conditions: Condition | null;
  description: string | null;
}

export interface LoungeInput {
  id: number;
  name: string;
  terminalId: number | null;
  openingHours: string | null;
  area?: 'schengen' | 'non_schengen' | 'international' | 'all';
  channels: ChannelInput[];
  exceptions: ExceptionInput[];
}

// ─── Evaluation options ────────────────────────────────────────────────────────

export interface EvalOptions {
  now?: Date;
  passengerTerminalId?: number;
  passengerCards?: ChannelType[];   // cards the passenger carries (priority_pass, etc.)
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface AccessResult {
  status: AccessStatus;
  confidence: number;
  reason: string;
  guest_allowed: boolean;
  source: string;
  accessVia?: string;  // human-readable label: "Priority Pass", "oneworld Sapphire", …
}
