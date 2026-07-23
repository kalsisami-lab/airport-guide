import type { AllianceCode, AllianceTier, PassengerContext, StatusContext } from '../normalization/types';
import type { AccessResult } from '../engine/types';
import type { AirportServiceRuleInput, ServiceType } from './types';
import { evalCondition, meetsTier, type EvalCtx } from '../engine/predicates';

const TIER_LABEL: Partial<Record<AllianceTier, string>> = {
  oneworld_emerald:  'oneworld Emerald',
  oneworld_sapphire: 'oneworld Sapphire',
  oneworld_ruby:     'oneworld Ruby',
  star_gold:         'Star Alliance Gold',
  star_silver:       'Star Alliance Silver',
  skyteam_elite_plus:'SkyTeam Elite Plus',
  skyteam_elite:     'SkyTeam Elite',
};

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isActive(validFrom: string, validTo: string | null, now: Date): boolean {
  const today = toISODate(now);
  if (validFrom > today) return false;
  if (validTo !== null && validTo < today) return false;
  return true;
}

function confidenceToStatus(confidence: number): AccessResult['status'] {
  if (confidence >= 0.85) return 'allowed';
  if (confidence >= 0.60) return 'likely_allowed';
  return 'not_enough_info';
}

function tierToAlliance(tier: AllianceTier): AllianceCode {
  if (tier.startsWith('oneworld_')) return 'oneworld';
  if (tier.startsWith('star_'))     return 'star_alliance';
  if (tier.startsWith('skyteam_'))  return 'skyteam';
  return null;
}

function ruleMatches(
  rule: AirportServiceRuleInput,
  passenger: PassengerContext,
  status: StatusContext | null,
  fastTrackCards: Set<string>,
): boolean {
  const evalCtx: EvalCtx = { passenger, status };

  if (rule.conditions !== null && !evalCondition(rule.conditions, evalCtx)) return false;

  if (rule.carrierRestriction !== null && rule.carrierRestriction.length > 0) {
    if (!rule.carrierRestriction.includes(passenger.operatingCarrier)) return false;
  }

  if (rule.minAllianceTier !== null) {
    if (!status) return false;
    if (!meetsTier(status.allianceTier, rule.minAllianceTier)) return false;
    const required = tierToAlliance(rule.minAllianceTier);
    if (passenger.operatingAlliance !== required) return false;
  }

  // Credit card gate: provider is the sole criterion (no tier, carrier, or conditions).
  // When provider coexists with other criteria it acts as a display label only.
  const providerIsGate =
    rule.provider !== null &&
    rule.provider !== 'paid' &&
    rule.minAllianceTier === null &&
    (rule.carrierRestriction === null || rule.carrierRestriction.length === 0) &&
    rule.conditions === null;
  if (providerIsGate && !fastTrackCards.has(rule.provider!)) return false;

  return true;
}

export function evaluateAirportService(
  passenger: PassengerContext,
  status: StatusContext | null,
  serviceType: ServiceType,
  rules: AirportServiceRuleInput[],
  now: Date,
  fastTrackCards: Set<string> = new Set(),
): AccessResult {
  // 1. not_applicable: priority_boarding with departure already passed
  if (
    serviceType === 'priority_boarding' &&
    passenger.departureTime !== undefined &&
    new Date(passenger.departureTime) < now
  ) {
    return {
      status:        'not_applicable',
      confidence:    0.95,
      reason:        'Departure time has already passed',
      guest_allowed: false,
      source:        'departure_time_check',
    };
  }

  // 2. not_enough_info: no rules seeded for this service at this airport.
  //    Do NOT claim the service is "not offered" — most airports simply have
  //    incomplete data. Only ~5 of 90+ seeded airports have any service rules,
  //    yet many of the unseeded ones (ARN, AMS, CPH, ...) do offer fast track
  //    in reality. Reporting "not offered" with confidence 1.0 was actively
  //    misleading. Silence ≠ certainty. See §63.
  if (rules.length === 0) {
    return {
      status:        'not_enough_info',
      confidence:    0.0,
      reason:        `No ${serviceType} rules seeded for this airport`,
      guest_allowed: false,
      source:        'no_rules',
    };
  }

  const activeRules = rules.filter((r) => isActive(r.validFrom, r.validTo, now));

  // 4. Deny rules evaluated first (priority DESC)
  const denyRules = activeRules
    .filter((r) => r.action === 'deny')
    .sort((a, b) => b.priority - a.priority);

  for (const rule of denyRules) {
    if (ruleMatches(rule, passenger, status, fastTrackCards)) {
      return {
        status:        'denied',
        confidence:    rule.confidence,
        reason:        rule.notes ?? 'Access denied by rule',
        guest_allowed: false,
        source:        `rule:${rule.id}`,
      };
    }
  }

  // 5. Allow rules (priority DESC)
  const allowRules = activeRules
    .filter((r) => r.action === 'allow')
    .sort((a, b) => b.priority - a.priority);

  for (const rule of allowRules) {
    if (ruleMatches(rule, passenger, status, fastTrackCards)) {
      if (rule.provider === 'paid') {
        return {
          status:        'paid_available',
          confidence:    rule.confidence,
          reason:        rule.notes ?? 'Access available for purchase',
          guest_allowed: false,
          source:        `rule:${rule.id}`,
        };
      }

      const tierNote     = rule.minAllianceTier ? ` (${rule.minAllianceTier})` : '';
      const providerNote = rule.provider        ? ` via ${rule.provider}`       : '';
      const accessVia    = rule.minAllianceTier
        ? (TIER_LABEL[rule.minAllianceTier] ?? rule.minAllianceTier)
        : rule.provider ?? undefined;

      return {
        status:        confidenceToStatus(rule.confidence),
        confidence:    rule.confidence,
        reason:        `${serviceType} access granted${tierNote}${providerNote}`,
        guest_allowed: false,
        source:        `rule:${rule.id}`,
        accessVia,
      };
    }
  }

  // 6. Default — no allow rule matched, no explicit deny rule matched either.
  //    This is silence, not denial. Rules describe positive access paths;
  //    absence of a match means "this passenger doesn't fit any modeled
  //    path", not "this passenger is explicitly denied". Chip should be
  //    "?" not "✗". See §63.
  return {
    status:        'not_enough_info',
    confidence:    0.0,
    reason:        'No matching access rule found (rules exist but do not cover this passenger)',
    guest_allowed: false,
    source:        'default',
  };
}
