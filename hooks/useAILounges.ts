'use client';

import { useState, useEffect, useRef } from 'react';
import type { CreditCard } from '@/data/creditCards';
import type { AirlineStatus } from '@/data/airlineStatuses';
import type { AILoungeState, AILounge } from '@/lib/aiLounge';

interface Query {
  airportIata: string | null;
  airportName: string | null;
  terminal?: string;
  airline?: string;
  card: CreditCard | null;
  status: AirlineStatus | null;
  departureZone?: 'schengen' | 'non-schengen' | 'international';
  destination?: string;
  gate?: string;
}

export function useAILounges(query: Query): AILoungeState & { refetch: () => void } {
  const [state, setState] = useState<AILoungeState>({ phase: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const lastKeyRef = useRef('');

  function doFetch(q: Query) {
    if (!q.airportIata || (!q.card && !q.status)) {
      setState({ phase: 'idle' });
      return;
    }

    controllerRef.current?.abort();
    controllerRef.current = new AbortController();

    setState({ phase: 'fetching' });

    const allianceTier = q.status?.accessMethods.find(
      (m) =>
        m.startsWith('oneworld') ||
        m.startsWith('star-alliance') ||
        m.startsWith('skyteam') ||
        m.startsWith('finnair-plus'),
    );
    // Map internal IDs to human-readable alliance tiers
    const tierLabel: Record<string, string> = {
      'oneworld-emerald':   'oneworld Emerald',
      'oneworld-sapphire':  'oneworld Sapphire',
      'star-alliance-gold': 'Star Alliance Gold',
      'skyteam-elite-plus': 'SkyTeam Elite Plus',
      'finnair-plus-platinum': 'oneworld Emerald (Finnair Platinum)',
      'finnair-plus-gold':     'oneworld Sapphire (Finnair Gold)',
    };

    const body = {
      airportIata:    q.airportIata,
      airportName:    q.airportName ?? q.airportIata,
      terminal:       q.terminal,
      airline:        q.airline,
      cardName:       q.card?.name,
      cardNetworks:   q.card?.loungeAccess,
      statusName:     q.status?.name,
      allianceTier:   allianceTier ? (tierLabel[allianceTier] ?? allianceTier) : undefined,
      departureZone:  q.departureZone,
      destination:    q.destination,
      gate:           q.gate,
    };

    // Fake progress: move to 'verifying' after ~3 s so the UI shows both steps
    const verifyTimer = setTimeout(() => setState({ phase: 'verifying' }), 3000);

    fetch('/api/lounges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controllerRef.current.signal,
    })
      .then((r) => r.json())
      .then((data: { lounges?: AILounge[]; notes?: string; error?: string }) => {
        clearTimeout(verifyTimer);
        if (data.error && !data.lounges?.length) throw new Error(data.error);
        setState({ phase: 'done', lounges: data.lounges ?? [], notes: data.notes });
      })
      .catch((err: Error) => {
        clearTimeout(verifyTimer);
        if (err.name === 'AbortError') return;
        setState({ phase: 'error', message: err.message });
      });
  }

  useEffect(() => {
    const key = [
      query.airportIata,
      query.card?.id ?? '',
      query.status?.id ?? '',
      query.airline ?? '',
      query.departureZone ?? '',
    ].join('|');

    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    doFetch(query);

    return () => {
      controllerRef.current?.abort();
    };
  // The key string above captures all relevant deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.airportIata, query.card?.id, query.status?.id, query.airline, query.departureZone]);

  return { ...state, refetch: () => doFetch(query) };
}
