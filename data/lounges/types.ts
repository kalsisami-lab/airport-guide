import type { LoungeNetwork, LoungeClass, AILoungeTier } from '@/lib/aiLounge';

/**
 * Controls who can enter an alliance lounge.
 *
 * 'all-alliance'    – Any carrier in the alliance with Sapphire/Emerald (or Gold) status.
 *                     Reciprocal-access lounges (e.g. JAL Sakura at FRA open to AY flyers).
 * 'carrier-specific' – Only passengers flying the carrier(s) listed in allowedAirlines,
 *                      plus the required status tier for that lounge class.
 *                      (e.g. Finnair Platinum Wing — AY Emerald only.)
 */
export type AllianceAccess = 'all-alliance' | 'carrier-specific';

export type StaticLounge = {
  id: string;
  name: string;
  airportCode: string;
  terminal: string;
  locationDescription: string;
  area: 'schengen' | 'non-schengen' | 'international' | 'all';
  tier: AILoungeTier;
  loungeClass: LoungeClass;
  networks: LoungeNetwork[];
  allowedAlliances: string[];
  allowedAirlines: string[];
  openingHours: string;
  amenities: string[];
  gateDistances: Record<string, number>;
  /** Defaults to 'all-alliance' when omitted (card/independent lounges ignore this). */
  allianceAccess?: AllianceAccess;
};
