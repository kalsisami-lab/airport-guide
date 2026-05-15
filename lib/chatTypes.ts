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
  lounges?: { name: string; reason: string; accessible: boolean; tier: string }[];
  allianceAccess?: { alliance: string; tier: string } | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
