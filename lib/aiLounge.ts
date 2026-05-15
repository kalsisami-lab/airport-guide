export type AILoungeTier = 'ultra-premium' | 'premium' | 'standard';

export type LoungeNetwork =
  | 'oneworld'
  | 'star-alliance'
  | 'skyteam'
  | 'priority-pass'
  | 'lounge-key'
  | 'dragon-pass'
  | 'amex-centurion'
  | 'airline-own'
  | 'independent';

export type LoungeClass = 'first' | 'business' | 'standard';

export type AILounge = {
  id: string;
  name: string;
  location: string;
  accessMethod: string;       // human-readable reason (e.g. "oneworld Emerald")
  hours: string;
  amenities: string[];
  tier: AILoungeTier;
  walkingInfo?: string;       // e.g. "~5 min from Gate 36"
  network: LoungeNetwork;     // machine-readable access path for filtering
  loungeClass: LoungeClass;   // lounge tier class for alliance-tier validation
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
