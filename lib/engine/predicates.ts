import type { AllianceTier, PassengerContext, StatusContext } from '../normalization/types';
import type { Condition } from './types';

export interface EvalCtx {
  passenger: PassengerContext;
  status: StatusContext | null;
}

// Higher = better. Used for min_tier comparisons.
const TIER_PRIORITY: Record<AllianceTier, number> = {
  oneworld_emerald:   4,
  oneworld_sapphire:  3,
  oneworld_ruby:      1,
  star_gold:          3,
  star_silver:        1,
  skyteam_elite_plus: 3,
  skyteam_elite:      1,
  none:               0,
};

// Alliance prefix encoded in each tier name.
const TIER_PREFIX: Record<AllianceTier, string> = {
  oneworld_emerald:   'oneworld_',
  oneworld_sapphire:  'oneworld_',
  oneworld_ruby:      'oneworld_',
  star_gold:          'star_',
  star_silver:        'star_',
  skyteam_elite_plus: 'skyteam_',
  skyteam_elite:      'skyteam_',
  none:               '',
};

// Resolves a dot-path from the eval context ('passenger.cabin', 'status.allianceTier', …).
function resolveField(ctx: EvalCtx, field: string): unknown {
  const parts = field.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// True if userTier is in the same alliance AND is at least as good as minTier.
export function meetsTier(userTier: AllianceTier, minTier: AllianceTier): boolean {
  if (minTier === 'none') return true;
  const userPrefix = TIER_PREFIX[userTier];
  const minPrefix  = TIER_PREFIX[minTier];
  if (!userPrefix || userPrefix !== minPrefix) return false;
  return TIER_PRIORITY[userTier] >= TIER_PRIORITY[minTier];
}

// Evaluates a predicate tree against an EvalCtx.
// Unknown operators evaluate to false (safe default — never grant access on bad data).
export function evalCondition(cond: Condition, ctx: EvalCtx): boolean {
  switch (cond.op) {
    case 'equals':
      return resolveField(ctx, cond.field) === cond.value;

    case 'in':
      return cond.values.includes(resolveField(ctx, cond.field));

    case 'min_tier': {
      const tier = (ctx.status?.allianceTier ?? 'none') as AllianceTier;
      return meetsTier(tier, cond.value);
    }

    case 'same_day_departure':
      return ctx.passenger.sameDayDeparture === cond.value;

    case 'country_equals':
      return ctx.passenger.departureCountryCode === cond.value;

    case 'not':
      return !evalCondition(cond.condition, ctx);

    case 'and':
      return cond.conditions.every((c) => evalCondition(c, ctx));

    case 'or':
      return cond.conditions.some((c) => evalCondition(c, ctx));

    default:
      return false;
  }
}
