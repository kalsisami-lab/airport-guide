'use client';

import { useState, useCallback } from 'react';
import { searchGlobalFlight, type GlobalSearchResult } from '@/lib/globalFlightSearch';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; data: GlobalSearchResult }
  | { status: 'not-found' }
  | { status: 'error' };

export function useGlobalFlightSearch() {
  const [state, setState] = useState<State>({ status: 'idle' });

  const search = useCallback(async (flightNumber: string, apiKey?: string | null) => {
    setState({ status: 'loading' });
    try {
      const data = await searchGlobalFlight(flightNumber, apiKey);
      setState(data ? { status: 'found', data } : { status: 'not-found' });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, search, reset };
}
