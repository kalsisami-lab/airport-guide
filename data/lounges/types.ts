import type { LoungeNetwork, LoungeClass, AILoungeTier } from '@/lib/aiLounge';

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
};
