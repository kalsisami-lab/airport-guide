import type { PassengerContext, StatusContext } from '../normalization/types';
import { meetsTier, evalCondition, type EvalCtx } from '../engine/predicates';
import type { PriorityBoardingResult, PriorityBoardingRuleInput } from './types';

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function evaluatePriorityBoarding(
  passenger: PassengerContext,
  status: StatusContext | null,
  rules: PriorityBoardingRuleInput[],
  now: Date,
): PriorityBoardingResult {
  // Programme-level override: this tier does not carry a priority boarding benefit.
  if (status !== null && status.fastTrack === false) {
    return {
      available:  false,
      confidence: 0.95,
      reason:     'Priority boarding not included in your status tier',
      source:     'status_tier',
    };
  }

  const today   = toISODate(now);
  const evalCtx: EvalCtx = { passenger, status };

  const active = rules
    .filter((r) => r.validFrom <= today && (r.validTo === null || r.validTo >= today))
    .sort((a, b) => b.priority - a.priority);

  for (const rule of active) {
    if (rule.conditions !== null && !evalCondition(rule.conditions, evalCtx)) continue;

    if (
      rule.carrierRestriction &&
      rule.carrierRestriction.length > 0 &&
      !rule.carrierRestriction.includes(passenger.operatingCarrier)
    ) continue;

    if (rule.minAllianceTier) {
      if (!status) continue;
      if (!meetsTier(status.allianceTier, rule.minAllianceTier)) continue;
    }

    return {
      available:  true,
      confidence: rule.confidence,
      reason:     status
        ? `Priority boarding available via ${status.allianceTier} status`
        : 'Priority boarding available',
      source: `rule:${rule.id}`,
    };
  }

  return {
    available:  false,
    confidence: 0.9,
    reason:     'Priority boarding not available for this flight and status combination',
    source:     'default',
  };
}
