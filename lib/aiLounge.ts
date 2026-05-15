export type AILoungeTier = 'ultra-premium' | 'premium' | 'standard';

export type AILounge = {
  id: string;
  name: string;
  location: string;
  accessMethod: string; // human-readable reason (e.g. "oneworld Emerald")
  hours: string;
  amenities: string[];
  tier: AILoungeTier;
  walkingInfo?: string; // e.g. "~5 min from Gate 36"
};

export type AILoungeResponse = {
  lounges: AILounge[];
  notes?: string;
};

export type AILoungePhase = 'idle' | 'fetching' | 'verifying' | 'done' | 'error';

export type AILoungeState =
  | { phase: 'idle' }
  | { phase: 'fetching' }
  | { phase: 'verifying' }
  | { phase: 'done'; lounges: AILounge[]; notes?: string }
  | { phase: 'error'; message: string };
