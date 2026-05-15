'use client';

import { useState, useEffect } from 'react';
import { lookupFlight, type FlightInfo } from '@/lib/flightLookup';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; data: FlightInfo }
  | { status: 'not-found' }
  | { status: 'error' };

const DEBOUNCE_MS = 600;
const MIN_LENGTH = 3;

export function useFlightLookup(flightNumber: string): State {
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    const trimmed = flightNumber.trim();
    if (trimmed.length < MIN_LENGTH) { setState({ status: 'idle' }); return; }

    setState({ status: 'loading' });

    const timer = setTimeout(async () => {
      try {
        const data = await lookupFlight(trimmed);
        setState(data ? { status: 'found', data } : { status: 'not-found' });
      } catch {
        setState({ status: 'error' });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [flightNumber]);

  return state;
}
