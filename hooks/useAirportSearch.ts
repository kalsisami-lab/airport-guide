'use client';

import { useState, useCallback, useRef } from 'react';
import type { Airport } from '@/data/airports';

export function useAirportSearch(apiKey: string | null) {
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const headers: HeadersInit = {};
        // '__server__' means the server has the key in env — don't forward it as a header
        if (apiKey && apiKey !== '__server__') headers['x-flight-api-key'] = apiKey;
        const res = await fetch(`/api/airports?q=${encodeURIComponent(query)}`, { headers });
        if (res.ok) {
          const data = await res.json() as { airports: Airport[] };
          setResults(data.airports);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [apiKey]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setResults([]);
    setLoading(false);
  }, []);

  return { results, loading, search, clear };
}
