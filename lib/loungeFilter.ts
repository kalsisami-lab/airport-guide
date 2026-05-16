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
  // Owning/allowed airlines for this specific lounge (from StaticLounge.allowedAirlines).
  // Used to enforce carrier-level access for airline-own networks:
  // if the carrier is known, it must appear in this list.
  allowedAirlines: string[];
}

const VALID_NETWORKS = new Set<LoungeNetwork>([
  'oneworld', 'star-alliance', 'skyteam',
  'priority-pass', 'lounge-key', 'dragon-pass',
  'amex-centurion', 'airline-own', 'independent',
]);

const VALID_CLASSES = new Set<LoungeClass>(['first', 'business', 'standard']);

function resolveCarrierAlliance(code: string | null): Alliance | null {
  if (!code) return null;
  return CARRIER_ALLIANCE[code.toUpperCase()] ?? null;
}

function resolveUserTier(methods: string[]): { alliance: Alliance; tier: string } | null {
  for (const m of methods) {
    const entry = STATUS_ALLIANCE_TIER[m];
    if (entry) return entry;
  }
  return null;
}

/**
 * Applies hard alliance rules on top of the AI-generated lounge list.
 *
 * For alliance lounges (oneworld / star-alliance / skyteam):
 *   1. The operating carrier MUST be in that alliance (when the carrier is known).
 *   2. The user MUST hold status in that alliance.
 *   3. The user's tier MUST grant access to the lounge's class (first / business).
 *
 * For card-network lounges (priority-pass / lounge-key / etc.):
 *   User must carry the matching card network.
 *
 * For airline-own and independent lounges the AI's judgment is preserved.
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
      : 'business'; // safe default for unknown

    switch (network) {
      case 'oneworld':
      case 'star-alliance':
      case 'skyteam': {
        const alliance = network as Alliance;

        // Rule 1: carrier must be in this alliance (only enforced when carrier is known)
        if (ctx.operatingCarrierCode !== null && carrierAlliance !== alliance) {
          return false;
        }

        // Rule 2: user must have status in this alliance
        if (!userTier || userTier.alliance !== alliance) return false;

        // Rule 3: user's tier must unlock this lounge class
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
        // Accept both spellings: 'amex-platinum' (from creditCards.loungeAccess)
        // and 'amex-centurion' (the LoungeNetwork type name).
        return ctx.cardNetworks.includes('amex-platinum') || ctx.cardNetworks.includes('amex-centurion');

      case 'airline-own': {
        // If the operating carrier is known, it must be in the lounge's allowedAirlines.
        // This is the key guard against cross-alliance leakage (e.g. AY reaching LH lounges).
        // When carrier is null (unknown) we stay permissive — we can't disprove access.
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
