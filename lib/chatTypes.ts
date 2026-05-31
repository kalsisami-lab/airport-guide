export interface ChatContext {
  airport?: string | null;
  airportIata?: string | null;
  gate?: string | null;
  cardName?: string | null;
  statusName?: string | null;
  flightNumber?: string | null;
  destination?: string | null;
  area?: string | null;
  fastTrack?: boolean;
  lounges?: { name: string; reason: string; accessible: boolean; tier: string; amenities?: string[] }[];
  allianceAccess?: { alliance: string; tier: string } | null;
  // Enriched summary from the new entitlements engine (optional — absent when engine not yet loaded)
  entitlements_summary?: {
    alliance_tier: string | null;
    fast_track_status: string;
    accessible_lounge_count: number;
  } | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
