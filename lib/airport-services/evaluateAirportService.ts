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

  return true;
}

export function evaluateAirportService(
  passenger: PassengerContext,
  status: StatusContext | null,
  serviceType: ServiceType,
  rules: AirportServiceRuleInput[],
  now: Date,
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

  // 2. not_offered_at_airport: no rules defined for this service
  if (rules.length === 0) {
    return {
      status:        'not_offered_at_airport',
      confidence:    1.0,
      reason:        `${serviceType} is not offered at this airport`,
      guest_allowed: false,
      source:        'no_rules',
    };
  }

  // 3. status.fastTrack gate — only for fast_track_security
  if (serviceType === 'fast_track_security' && status !== null && status.fastTrack === false) {
    return {
      status:        'denied',
      confidence:    0.95,
      reason:        'Fast track not included in your status tier',
      guest_allowed: false,
      source:        'status_tier',
    };
  }

  const activeRules = rules.filter((r) => isActive(r.validFrom, r.validTo, now));

  // 4. Deny rules evaluated first (priority DESC)
  const denyRules = activeRules
    .filter((r) => r.action === 'deny')
    .sort((a, b) => b.priority - a.priority);

  for (const rule of denyRules) {
    if (ruleMatches(rule, passenger, status)) {
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
    if (ruleMatches(rule, passenger, status)) {
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

  // 6. Default
  return {
    status:        'denied',
    confidence:    0.95,
    reason:        'No matching access rule found',
    guest_allowed: false,
    source:        'default',
  };
}
