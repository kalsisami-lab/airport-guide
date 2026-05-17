import type { PassengerContext, StatusContext } from '../normalization/types';
import { meetsTier } from '../engine/predicates';
import { evalCondition, type EvalCtx } from '../engine/predicates';
import type { FastTrackResult, FastTrackRuleInput } from './types';

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function evaluateFastTrack(
  passenger: PassengerContext,
  status: StatusContext | null,
  rules: FastTrackRuleInput[],
  now: Date,
): FastTrackResult {
  const today  = toISODate(now);
  const evalCtx: EvalCtx = { passenger, status };

  const active = rules
    .filter((r) => r.validFrom <= today && (r.validTo === null || r.validTo >= today))
    .sort((a, b) => b.priority - a.priority);

  for (const rule of active) {
    // Conditions guard
    if (rule.conditions !== null && !evalCondition(rule.conditions, evalCtx)) continue;

    // Carrier restriction
    if (
      rule.carrierRestriction &&
      rule.carrierRestriction.length > 0 &&
      !rule.carrierRestriction.includes(passenger.operatingCarrier)
    ) continue;

    // Alliance tier requirement
    if (rule.minAllianceTier) {
      if (!status) continue;
      if (!meetsTier(status.allianceTier, rule.minAllianceTier)) continue;
    }

    return {
      available:  true,
      confidence: rule.confidence,
      reason:     status
        ? `Fast track available via ${status.allianceTier} status`
        : `Fast track available`,
      source: `rule:${rule.id}`,
    };
  }

  return {
    available:  false,
    confidence: 0.9,
    reason:     'Fast track not available for this flight and status combination',
    source:     'default',
  };
}
