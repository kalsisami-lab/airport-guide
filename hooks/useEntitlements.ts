'use client';

import { useState, useEffect, useRef } from 'react';
import type { CreditCard } from '@/data/creditCards';
import type { AirlineStatus } from '@/data/airlineStatuses';
import type { AirportEntitlements } from '@/lib/entitlements/types';
import type { ChannelType } from '@/lib/engine/types';

// Maps static AirlineStatus.id → DB { programCode, tierName }.
// Generic alliance-tier entries (oneworld-sapphire etc.) use a representative FFP
// so the engine can resolve the correct alliance tier from the DB.
const STATUS_TO_DB: Record<string, { programCode: string; tierName: string }> = {
  'finnair-basic':      { programCode: 'ay-plus',        tierName: 'Basic'              },
  'finnair-silver':     { programCode: 'ay-plus',        tierName: 'Silver'             },
  'finnair-gold':       { programCode: 'ay-plus',        tierName: 'Gold'               },
  'finnair-platinum':   { programCode: 'ay-plus',        tierName: 'Platinum'           },
  'oneworld-ruby':      { programCode: 'ay-plus',        tierName: 'Silver'             },
  'oneworld-sapphire':  { programCode: 'ay-plus',        tierName: 'Gold'               },
  'oneworld-emerald':   { programCode: 'ay-plus',        tierName: 'Platinum'           },
  'star-silver':        { programCode: 'lh-miles-more',  tierName: 'Frequent Traveller' },
  'star-gold':          { programCode: 'lh-miles-more',  tierName: 'Senator'            },
  'skyteam-elite':      { programCode: 'af-flying-blue', tierName: 'Silver'             },
  'skyteam-elite-plus': { programCode: 'af-flying-blue', tierName: 'Gold'               },
};

// Maps CreditCard loungeAccess values → ChannelType used by the new engine.
const CARD_TO_CHANNEL: Partial<Record<string, ChannelType>> = {
  'priority-pass': 'priority_pass',
  'lounge-key':    'lounge_key',
  'dragon-pass':   'dragon_pass',
  'amex-platinum': 'amex_centurion',
  'op-card':       'op_card',
};

export interface EntitlementsQuery {
  airportIata:          string | null;
  arrivalIata?:         string | null;
  operatingCarrierCode: string | null;
  card:                 CreditCard | null;
  status:               AirlineStatus | null;
  gate?:                string;
  cabin?:               'economy' | 'business' | 'first';
}

export type EntitlementsState =
  | { phase: 'idle' }
  | { phase: 'fetching' }
  | { phase: 'done'; data: AirportEntitlements }
  | { phase: 'error'; message: string };

export function useEntitlements(
  query: EntitlementsQuery,
): EntitlementsState & { refetch: () => void } {
  const [state, setState] = useState<EntitlementsState>({ phase: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const lastKeyRef    = useRef('');

  function doFetch(q: EntitlementsQuery) {
    if (!q.airportIata) {
      setState({ phase: 'idle' });
      return;
    }

    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    setState({ phase: 'fetching' });

    const dbCard = q.status ? STATUS_TO_DB[q.status.id] : undefined;
    const statusCards = dbCard ? [dbCard] : [];

    const channels: ChannelType[] = q.card
      ? (q.card.loungeAccess.flatMap((a) => {
          const ch = CARD_TO_CHANNEL[a];
          return ch ? [ch] : [];
        }) as ChannelType[])
      : [];

    const fastTrackCards: string[] = q.card?.fastTrackProviders ?? [];

    const body = {
      flight: {
        operatingCarrier: q.operatingCarrierCode ?? 'UNKN',
        cabin:            q.cabin ?? 'economy',
        departureAirport: q.airportIata,
        arrivalAirport:   q.arrivalIata ?? 'UNKN',
        gate:             q.gate,
      },
      user: {
        statusCards,
        cards: channels,
        fastTrackCards,
      },
    };

    fetch('/api/entitlements', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controllerRef.current.signal,
    })
      .then((r) => r.json())
      .then((data: AirportEntitlements & { error?: string }) => {
        if (data.error) throw new Error(data.error);
        setState({ phase: 'done', data });
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setState({ phase: 'error', message: err.message });
      });
  }

  useEffect(() => {
    const key = [
      query.airportIata,
      query.card?.id             ?? '',
      query.status?.id           ?? '',
      query.operatingCarrierCode ?? '',
      query.arrivalIata          ?? '',
      query.gate                 ?? '',
      query.cabin                ?? '',
    ].join('|');

    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    doFetch(query);

    return () => { controllerRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query.airportIata,
    query.card?.id,
    query.status?.id,
    query.operatingCarrierCode,
    query.arrivalIata,
    query.gate,
    query.cabin,
  ]);

  return { ...state, refetch: () => doFetch(query) };
}
