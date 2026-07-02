import type { AllianceCode, AllianceTier, PassengerContext, StatusContext } from '../normalization/types';
import type {
  AccessResult,
  ChannelInput,
  EvalOptions,
  LoungeInput,
  RuleInput,
} from './types';
import { evalCondition, meetsTier, type EvalCtx } from './predicates';

// ─── Confidence → status ──────────────────────────────────────────────────────

function confidenceToStatus(confidence: number): AccessResult['status'] {
  if (confidence >= 0.85) return 'allowed';
  if (confidence >= 0.60) return 'likely_allowed';
  return 'not_enough_info';
}

// ─── Tier → human label ───────────────────────────────────────────────────────

const TIER_LABEL: Partial<Record<AllianceTier, string>> = {
  oneworld_emerald:   'oneworld Emerald',
  oneworld_sapphire:  'oneworld Sapphire',
  oneworld_ruby:      'oneworld Ruby',
  star_gold:          'Star Alliance Gold',
  star_silver:        'Star Alliance Silver',
  skyteam_elite_plus: 'SkyTeam Elite Plus',
  skyteam_elite:      'SkyTeam Elite',
};

const CHANNEL_LABEL: Partial<Record<string, string>> = {
  priority_pass:  'Priority Pass',
  lounge_key:     'LoungeKey',
  dragon_pass:    'DragonPass',
  amex_centurion: 'Amex Platinum',
  op_card:        'OP Card',
  invitation:     'Invitation',
};

// ─── Tier → alliance ──────────────────────────────────────────────────────────

function tierToAlliance(tier: AllianceTier): AllianceCode {
  if (tier.startsWith('oneworld_')) return 'oneworld';
  if (tier.startsWith('star_'))     return 'star_alliance';
  if (tier.startsWith('skyteam_'))  return 'skyteam';
  return null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isActive(validFrom: string, validTo: string | null, now: Date): boolean {
  const today = toISODate(now);
  if (validFrom > today) return false;
  if (validTo !== null && validTo < today) return false;
  return true;
}

// ─── Opening-hours check ──────────────────────────────────────────────────────
// Returns a 'closed' result if we can determine the lounge is closed, else null.

function checkOpeningHours(openingHours: string | null, now: Date): AccessResult | null {
  if (!openingHours) return null;
  const h = openingHours.trim().toLowerCase();
  if (h === '24 hours' || h === '24/7') return null;

  // Handles "Daily HH:MM–HH:MM" (en-dash or hyphen)
  const m = openingHours.match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;  // unrecognised format — cannot conclude closed

  const openMin  = Number(m[1]) * 60 + Number(m[2]);
  const closeMin = Number(m[3]) * 60 + Number(m[4]);
  const nowMin   = now.getHours() * 60 + now.getMinutes();

  const isOpen =
    closeMin > openMin
      ? nowMin >= openMin && nowMin < closeMin          // same-day window
      : nowMin >= openMin || nowMin < closeMin;          // overnight wrap

  if (!isOpen) {
    return {
      status:       'closed',
      confidence:   0.85,
      reason:       `Lounge is closed (${openingHours})`,
      guest_allowed: false,
      source:       'opening_hours',
    };
  }
  return null;
}

// ─── Single-channel rule evaluator ───────────────────────────────────────────
// Returns AccessResult if the rule grants access, null if it doesn't match.

function evaluateChannelRule(
  channel: ChannelInput,
  rule: RuleInput,
  passenger: PassengerContext,
  status: StatusContext | null,
  evalCtx: EvalCtx,
  passengerCards: Set<string>,
): AccessResult | null {
  // Conditions predicate (optional guard on the rule itself)
  if (rule.conditions !== null && !evalCondition(rule.conditions, evalCtx)) return null;

  switch (channel.channelType) {
    case 'alliance_status': {
      if (!status) return null;
      if (!rule.minAllianceTier) return null;

      // Tier must meet the minimum (same alliance + priority)
      if (!meetsTier(status.allianceTier, rule.minAllianceTier)) return null;

      if (channel.allianceAccess === 'carrier_specific') {
        // Carrier must be explicitly listed
        if (
          rule.carrierRestriction &&
          rule.carrierRestriction.length > 0 &&
          !rule.carrierRestriction.includes(passenger.operatingCarrier)
        ) return null;
      } else {
        // all_alliance: operating carrier must be in the required alliance
        const required = tierToAlliance(rule.minAllianceTier);
        if (passenger.operatingAlliance !== required) return null;
      }

      return {
        status:       confidenceToStatus(rule.confidence),
        confidence:   rule.confidence,
        reason:       `Access granted via ${status.allianceTier} status`,
        guest_allowed: false,
        source:       `channel:${channel.id}:rule:${rule.id}`,
        accessVia:    TIER_LABEL[status.allianceTier] ?? status.allianceTier,
      };
    }

    case 'airline_own': {
      if (
        !rule.carrierRestriction ||
        !rule.carrierRestriction.includes(passenger.operatingCarrier)
      ) return null;
      return {
        status:       confidenceToStatus(rule.confidence),
        confidence:   rule.confidence,
        reason:       `Access granted for ${passenger.operatingCarrier} passengers`,
        guest_allowed: false,
        source:       `channel:${channel.id}:rule:${rule.id}`,
        accessVia:    passenger.operatingCarrier,
      };
    }

    case 'priority_pass':
    case 'lounge_key':
    case 'dragon_pass':
    case 'amex_centurion':
    case 'op_card':
    case 'invitation': {
      if (!passengerCards.has(channel.channelType)) return null;
      return {
        status:       confidenceToStatus(rule.confidence),
        confidence:   rule.confidence,
        reason:       `Access granted via ${channel.channelType}`,
        guest_allowed: channel.channelType !== 'invitation',
        source:       `channel:${channel.id}:rule:${rule.id}`,
        accessVia:    CHANNEL_LABEL[channel.channelType] ?? channel.channelType,
      };
    }

    case 'paid':
      return null;  // handled separately as fallback

    default:
      return null;
  }
}

// ─── Main evaluation function ─────────────────────────────────────────────────

export function evaluateLoungeAccess(
  passenger: PassengerContext,
  status: StatusContext | null,
  lounge: LoungeInput,
  opts?: EvalOptions,
): AccessResult {
  const now    = opts?.now ?? new Date();
  const evalCtx: EvalCtx = { passenger, status };
  const cards  = new Set<string>(opts?.passengerCards ?? []);

  // ── 1. Opening hours → closed? ─────────────────────────────────────────────
  const closedResult = checkOpeningHours(lounge.openingHours, now);
  if (closedResult) return closedResult;

  // ── 2. Terminal reachability ───────────────────────────────────────────────
  if (
    lounge.terminalId !== null &&
    opts?.passengerTerminalId !== undefined &&
    lounge.terminalId !== opts.passengerTerminalId
  ) {
    return {
      status:       'physically_unreachable',
      confidence:   0.7,
      reason:       `Lounge is in terminal ${lounge.terminalId}, passenger departs from terminal ${opts.passengerTerminalId}`,
      guest_allowed: false,
      source:       'terminal_check',
    };
  }

  // ── 2b. Schengen zone reachability ────────────────────────────────────────
  // Precedence: arrivalIsSchengen (destination IATA lookup, ground truth) wins.
  // passengerZone (UI hint) is a fallback used only when arrival lookup failed.
  const loungeArea = lounge.area ?? 'all';
  if (loungeArea === 'schengen' || loungeArea === 'non_schengen') {
    let destSchengen: boolean | null = passenger.arrivalIsSchengen ?? null;
    let zoneSource: 'flight' | 'hint' = 'flight';
    if (destSchengen === null && passenger.passengerZone) {
      destSchengen = passenger.passengerZone === 'schengen';
      zoneSource = 'hint';
    }
    if (destSchengen !== null) {
      const mismatch =
        (loungeArea === 'schengen'     && !destSchengen) ||
        (loungeArea === 'non_schengen' &&  destSchengen);
      if (mismatch) {
        const zoneLabel = loungeArea === 'schengen' ? 'Schengen' : 'non-Schengen';
        const otherLabel = loungeArea === 'schengen' ? 'non-Schengen' : 'Schengen';
        const reason = zoneSource === 'flight'
          ? `Lounge is in the ${zoneLabel} zone — not reachable on your ${otherLabel} flight`
          : `Lounge is in the ${zoneLabel} zone — not reachable from the ${otherLabel} area you selected`;
        return {
          status:       'physically_unreachable',
          confidence:   0.9,
          reason,
          guest_allowed: false,
          source:       'schengen_zone_check',
        };
      }
    }
  }

  // ── 3. DENY first: blackout exceptions (priority DESC) ────────────────────
  const activeExceptions = lounge.exceptions
    .filter((e) => isActive(e.validFrom, e.validTo, now))
    .sort((a, b) => b.priority - a.priority);

  for (const exc of activeExceptions) {
    if (exc.exceptionType !== 'blackout') continue;
    if (exc.conditions !== null && !evalCondition(exc.conditions, evalCtx)) continue;
    return {
      status:       'denied',
      confidence:   exc.confidence,
      reason:       exc.description ?? 'Access denied by blackout exception',
      guest_allowed: false,
      source:       `exception:${exc.id}`,
    };
  }

  // ── 4. ALLOW: access channels, rules sorted by priority DESC ──────────────
  let hasPaidChannel = false;

  const candidates = lounge.channels.flatMap((ch) => {
    if (ch.channelType === 'paid') {
      hasPaidChannel = true;
      return [];
    }
    return ch.rules
      .filter((r) => isActive(r.validFrom, r.validTo, now))
      .map((r) => ({ ch, rule: r }));
  }).sort((a, b) => b.rule.priority - a.rule.priority);

  for (const { ch, rule } of candidates) {
    const result = evaluateChannelRule(ch, rule, passenger, status, evalCtx, cards);
    if (result) return result;
  }

  // ── 5. Default ────────────────────────────────────────────────────────────
  if (hasPaidChannel) {
    return {
      status:       'paid_available',
      confidence:   0.9,
      reason:       'Access available for purchase',
      guest_allowed: false,
      source:       'paid_channel',
    };
  }

  return {
    status:       'denied',
    confidence:   0.95,
    reason:       'No matching access rule found',
    guest_allowed: false,
    source:       'default',
  };
}
