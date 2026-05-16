import type { AILounge, LoungeNetwork, LoungeClass } from './aiLounge';
import {
  CARRIER_ALLIANCE,
  STATUS_ALLIANCE_TIER,
  ALLIANCE_TIER_ACCESS,
  type Alliance,
} from '@/data/allianceRules';

interface FilterContext {
  operatingCarrierCode: string | null;  // IATA 2-letter code, null = unknown
  statusAccessMethods: string[];        // raw IDs from AirlineStatus.accessMethods
  cardNetworks: string[];               // e.g. ['priority-pass', 'lounge-key']
  allowedAirlines: string[];            // from StaticLounge.allowedAirlines
  /**
   * 'all-alliance'    – any carrier in the lounge's alliance + appropriate status tier.
   * 'carrier-specific' – carrier must be in allowedAirlines + appropriate status tier.
   * Defaults to 'all-alliance' when the lounge omits the field.
   */
  allianceAccess: 'all-alliance' | 'carrier-specific';
}

const VALID_NETWORKS = new Set<LoungeNetwork>([
  'oneworld', 'star-alliance', 'skyteam',
  'priority-pass', 'lounge-key', 'dragon-pass',
  'amex-centurion', 'airline-own', 'independent',
]);

const VALID_CLASSES = new Set<LoungeClass>(['first', 'business', 'standard']);

// Priority used to pick the HIGHEST status tier when multiple methods are supplied.
// A member who is Finnair Plus Platinum sends both 'finnair-plus-gold' (sapphire) and
// 'finnair-plus-platinum' (emerald); we must return emerald, not the first match.
const TIER_PRIORITY: Record<string, number> = {
  emerald:      4,
  sapphire:     3,
  ruby:         1,
  gold:         3,  // Star Alliance Gold
  silver:       1,  // Star Alliance Silver
  'elite-plus': 3,  // SkyTeam Elite Plus
  elite:        1,  // SkyTeam Elite
};

function resolveCarrierAlliance(code: string | null): Alliance | null {
  if (!code) return null;
  return CARRIER_ALLIANCE[code.toUpperCase()] ?? null;
}

/**
 * Returns the highest-tier STATUS_ALLIANCE_TIER entry found in the methods list.
 * Previously returned the FIRST match, which caused Platinum members to resolve
 * to Sapphire because 'finnair-plus-gold' appeared before 'finnair-plus-platinum'.
 */
function resolveUserTier(methods: string[]): { alliance: Alliance; tier: string } | null {
  let best: { alliance: Alliance; tier: string } | null = null;
  let bestPriority = -1;
  for (const m of methods) {
    const entry = STATUS_ALLIANCE_TIER[m];
    if (!entry) continue;
    const priority = TIER_PRIORITY[entry.tier] ?? 0;
    if (priority > bestPriority) {
      best = entry;
      bestPriority = priority;
    }
  }
  return best;
}

/**
 * Applies hard alliance rules on top of the AI-generated lounge list.
 *
 * For alliance lounges (oneworld / star-alliance / skyteam):
 *
 *   allianceAccess = 'all-alliance' (reciprocal partner lounges):
 *     1. The operating carrier MUST be in that alliance (when the carrier is known).
 *     2. The user MUST hold status in that alliance.
 *     3. The user's tier MUST unlock the lounge's class.
 *
 *   allianceAccess = 'carrier-specific' (airline's own lounges):
 *     1. The operating carrier MUST be in allowedAirlines (when the carrier is known).
 *     2. The user MUST hold status in that alliance.
 *     3. The user's tier MUST unlock the lounge's class.
 *
 * For card-network lounges (priority-pass / lounge-key / etc.):
 *   User must carry the matching card network.
 *
 * For airline-own / independent lounges:
 *   Carrier must be in allowedAirlines (used by independent.ts lounges only).
 */
export function applyHardFilter(lounges: AILounge[], ctx: FilterContext): AILounge[] {
  const carrierAlliance = resolveCarrierAlliance(ctx.operatingCarrierCode);
  const userTier = resolveUserTier(ctx.statusAccessMethods);

  return lounges.filter((lounge) => {
    const network: LoungeNetwork = VALID_NETWORKS.has(lounge.network)
      ? lounge.network
      : 'independent';

    const loungeClass: LoungeClass = VALID_CLASSES.has(lounge.loungeClass)
      ? lounge.loungeClass
      : 'business';

    switch (network) {
      case 'oneworld':
      case 'star-alliance':
      case 'skyteam': {
        const alliance = network as Alliance;

        if (ctx.allianceAccess === 'carrier-specific') {
          // Carrier must be one of the lounge's allowed airlines.
          if (ctx.operatingCarrierCode !== null && ctx.allowedAirlines.length > 0) {
            if (!ctx.allowedAirlines.includes(ctx.operatingCarrierCode.toUpperCase())) return false;
          }
        } else {
          // all-alliance: any carrier in the correct alliance.
          if (ctx.operatingCarrierCode !== null && carrierAlliance !== alliance) return false;
        }

        // Status is required for both access modes.
        if (!userTier || userTier.alliance !== alliance) return false;

        // Tier must unlock this lounge class (e.g. Ruby grants nothing; Sapphire → business).
        const allowed = (ALLIANCE_TIER_ACCESS[alliance]?.[userTier.tier] ?? []) as LoungeClass[];
        return allowed.includes(loungeClass);
      }

      case 'priority-pass':
        return ctx.cardNetworks.includes('priority-pass');

      case 'lounge-key':
        return ctx.cardNetworks.includes('lounge-key');

      case 'dragon-pass':
        return ctx.cardNetworks.includes('dragon-pass');

      case 'amex-centurion':
        return ctx.cardNetworks.includes('amex-platinum') || ctx.cardNetworks.includes('amex-centurion');

      case 'airline-own': {
        // Non-alliance carrier lounges (independent.ts). Carrier must match allowedAirlines.
        if (ctx.operatingCarrierCode !== null && ctx.allowedAirlines.length > 0) {
          return ctx.allowedAirlines.includes(ctx.operatingCarrierCode.toUpperCase());
        }
        return true;
      }

      case 'independent':
      default:
        return true;
    }
  });
}
