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

// §64: detailed match result — used to distinguish tier-only misses from other misses
// so that alliance_defined rules can produce a confident 'denied' when a passenger
// is below the required tier but everything else matches.
type MissReason =
  | 'condition_failed'
  | 'carrier_not_on_list'
  | 'no_status'
  | 'tier_insufficient'
  | 'wrong_alliance'
  | 'provider_not_present';
type MatchResult = { matched: true } | { matched: false; reason: MissReason };

function ruleMatchDetailed(
  rule: AirportServiceRuleInput,
  passenger: PassengerContext,
  status: StatusContext | null,
  fastTrackCards: Set<string>,
): MatchResult {
  const evalCtx: EvalCtx = { passenger, status };

  if (rule.conditions !== null && !evalCondition(rule.conditions, evalCtx)) {
    return { matched: false, reason: 'condition_failed' };
  }

  if (rule.carrierRestriction !== null && rule.carrierRestriction.length > 0) {
    if (!rule.carrierRestriction.includes(passenger.operatingCarrier)) {
      return { matched: false, reason: 'carrier_not_on_list' };
    }
  }

  if (rule.minAllianceTier !== null) {
    if (!status) return { matched: false, reason: 'no_status' };

    const requiredAlliance = tierToAlliance(rule.minAllianceTier);
    const userAlliance     = tierToAlliance(status.allianceTier);

    // Wrong-alliance status → not a tier issue
    if (userAlliance !== requiredAlliance) {
      return { matched: false, reason: 'wrong_alliance' };
    }
    // Same alliance, check tier hierarchy
    if (!meetsTier(status.allianceTier, rule.minAllianceTier)) {
      return { matched: false, reason: 'tier_insufficient' };
    }
    // Also gate on passenger's operating flight alliance
    if (passenger.operatingAlliance !== requiredAlliance) {
      return { matched: false, reason: 'wrong_alliance' };
    }
  }

  const providerIsGate =
    rule.provider !== null &&
    rule.provider !== 'paid' &&
    rule.minAllianceTier === null &&
    (rule.carrierRestriction === null || rule.carrierRestriction.length === 0) &&
    rule.conditions === null;
  if (providerIsGate && !fastTrackCards.has(rule.provider!)) {
    return { matched: false, reason: 'provider_not_present' };
  }

  return { matched: true };
}

function ruleMatches(
  rule: AirportServiceRuleInput,
  passenger: PassengerContext,
  status: StatusContext | null,
  fastTrackCards: Set<string>,
): boolean {
  return ruleMatchDetailed(rule, passenger, status, fastTrackCards).matched;
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

  // 6. §64 tier-hierarchy deny: check if any alliance_defined allow-rule
  //    missed ONLY due to tier insufficiency (or no status at all). If so,
  //    the miss is authoritative — the alliance's own policy declares that
  //    tier is required and the pax doesn't have it. Return `denied` (not
  //    `not_enough_info`).
  //
  //    Only fires when:
  //      - rule.tierSemantics === 'alliance_defined'
  //      - miss reason is tier_insufficient OR no_status
  //      - (carrier, condition, provider, alliance all fine)
  //
  //    All other miss reasons (carrier, wrong_alliance, condition, provider)
  //    fall through to not_enough_info — the app doesn't have a rule that
  //    covers this pax, but airport may have other paths we haven't modeled.
  for (const rule of allowRules) {
    if (rule.tierSemantics !== 'alliance_defined') continue;
    const detail = ruleMatchDetailed(rule, passenger, status, fastTrackCards);
    if (detail.matched) continue;  // shouldn't happen (would have returned above)
    if (detail.reason === 'tier_insufficient' || detail.reason === 'no_status') {
      const tierLabel = TIER_LABEL[rule.minAllianceTier!] ?? rule.minAllianceTier;
      return {
        status:        'denied',
        confidence:    0.9,
        reason:        `${serviceType} requires ${tierLabel}; passenger tier does not meet the alliance-defined threshold`,
        guest_allowed: false,
        source:        `rule:${rule.id}:tier_deny`,
      };
    }
  }

  // 7. Default — no allow rule matched, no explicit deny rule matched either,
  //    no alliance_defined tier miss. This is silence, not denial. Rules
  //    describe positive access paths; absence of a match means "this
  //    passenger doesn't fit any modeled path", not "explicitly denied".
  //    Chip should be "?" not "✗". See §63.
  return {
    status:        'not_enough_info',
    confidence:    0.0,
    reason:        'No matching access rule found (rules exist but do not cover this passenger)',
    guest_allowed: false,
    source:        'default',
  };
}
