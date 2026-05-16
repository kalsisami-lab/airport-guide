'use client';

import { useState, useMemo, useEffect } from 'react';
import SelectInput from './SelectInput';
import FastTrackStatus from './FastTrackStatus';
import AILoungeCard from './AILoungeCard';
import TravelAssistant from './TravelAssistant';
import Settings, { LS_FLIGHT_API_KEY } from './Settings';
import { airports, AIRLINE_HUB, type Airport } from '@/data/airports';
import { AIRPORT_META, getRegionLabel } from '@/lib/airportCountryData';
import { useAirportSearch } from '@/hooks/useAirportSearch';
import { creditCards, type CreditCard } from '@/data/creditCards';
import { airlineStatuses, type AirlineStatus } from '@/data/airlineStatuses';
import { destinationsByAirport, type Destination } from '@/data/destinations';
import { parseAirlineCode } from '@/lib/eligibility';
import { useFlightLookup } from '@/hooks/useFlightLookup';
import { useGlobalFlightSearch } from '@/hooks/useGlobalFlightSearch';
import { useAILounges } from '@/hooks/useAILounges';
import type { ChatContext } from '@/lib/chatTypes';

const LS_CARD   = 'airport-guide:cardId';
const LS_STATUS = 'airport-guide:statusId';

// Pinned airports always appear at the top of the dropdown when no search query
const PINNED_IATAS = new Set(airports.map((a) => a.iata));

const cardOptions = creditCards.map((c) => ({
  value: c.id,
  label: c.name,
  sublabel: `${c.issuer} · ${c.country}`,
}));

const statusOptions = airlineStatuses.map((s) => ({
  value: s.id,
  label: s.name,
  sublabel: s.airline,
}));

const areaOptions: { value: 'schengen' | 'non-schengen' | 'both'; label: string; sublabel: string }[] = [
  { value: 'both',         label: 'Show all lounges', sublabel: 'Both Schengen and Non-Schengen' },
  { value: 'schengen',     label: 'Schengen',         sublabel: 'Flights within Schengen Area (EU/EEA)' },
  { value: 'non-schengen', label: 'Non-Schengen',     sublabel: 'Flights outside Schengen Area' },
];

const FAST_TRACK_TIERS = new Set([
  'oneworld-emerald', 'oneworld-sapphire', 'star-alliance-gold',
  'skyteam-elite-plus', 'finnair-plus-platinum', 'finnair-plus-gold',
]);

export default function Dashboard() {
  const [airportIata, setAirportIata]           = useState<string | null>(null);
  const [airportManuallySet, setAirportManuallySet] = useState(false);
  const [dynamicAirports, setDynamicAirports]   = useState<Airport[]>([]);
  const [cardId, setCardId]                     = useState<string | null>(null);
  const [statusId, setStatusId]                 = useState<string | null>(null);
  const [flightNumber, setFlightNumber]         = useState('');
  const [flightSwapped, setFlightSwapped]       = useState(false);
  const [gateInput, setGateInput]               = useState('');
  const [gateManuallySet, setGateManuallySet]   = useState(false);
  const [manualArea, setManualArea]             = useState<'schengen' | 'non-schengen' | 'both'>('both');
  const [manualDestIata, setManualDestIata]     = useState<string | null>(null);
  const [hydrated, setHydrated]                 = useState(false);
  const [flightApiKey, setFlightApiKey]         = useState<string | null>(null);
  const [serverHasFlightKey, setServerHasFlightKey] = useState(false);

  // Check whether the server already has FLIGHT_API_KEY configured
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d: { hasFlightKey: boolean }) => { if (d.hasFlightKey) setServerHasFlightKey(true); })
      .catch(() => {});
  }, []);

  // Restore persisted card / status / API key on first mount
  useEffect(() => {
    const savedCard   = localStorage.getItem(LS_CARD);
    const savedStatus = localStorage.getItem(LS_STATUS);
    const savedApiKey = localStorage.getItem(LS_FLIGHT_API_KEY);
    if (savedCard)   setCardId(savedCard);
    if (savedStatus) setStatusId(savedStatus);
    if (savedApiKey) setFlightApiKey(savedApiKey);
    setHydrated(true);
  }, []);

  // Persist card selection
  useEffect(() => {
    if (!hydrated) return;
    if (cardId) localStorage.setItem(LS_CARD, cardId);
    else        localStorage.removeItem(LS_CARD);
  }, [cardId, hydrated]);

  // Persist status selection
  useEffect(() => {
    if (!hydrated) return;
    if (statusId) localStorage.setItem(LS_STATUS, statusId);
    else          localStorage.removeItem(LS_STATUS);
  }, [statusId, hydrated]);

  // Merge pinned static airports with dynamically discovered ones
  const allAirports = useMemo<Airport[]>(() => {
    const extra = dynamicAirports.filter((a) => !PINNED_IATAS.has(a.iata));
    return [...airports, ...extra];
  }, [dynamicAirports]);

  const airportOptions = useMemo(() => allAirports.map((a) => ({
    value: a.iata,
    label: `${a.name} (${a.iata})`,
    sublabel: `${a.city}${a.country ? `, ${a.country}` : ''}`,
  })), [allAirports]);

  const airport: Airport | null = useMemo(
    () => allAirports.find((a) => a.iata === airportIata) ?? null,
    [airportIata, allAirports],
  );

  const card: CreditCard | null = useMemo(
    () => creditCards.find((c) => c.id === cardId) ?? null,
    [cardId],
  );
  const status: AirlineStatus | null = useMemo(
    () => airlineStatuses.find((s) => s.id === statusId) ?? null,
    [statusId],
  );

  const airlineCode = parseAirlineCode(flightNumber);
  // Effective key: user's locally stored key, or a sentinel when the server has one configured
  const effectiveFlightKey = flightApiKey ?? (serverHasFlightKey ? '__server__' : null);

  const { results: airportSearchResults, loading: airportSearchLoading, search: searchAirports } = useAirportSearch(effectiveFlightKey);

  const airportSearchOptions = useMemo(() => airportSearchResults.map((a) => ({
    value: a.iata,
    label: `${a.name} (${a.iata})`,
    sublabel: `${a.city}, ${a.country}`,
  })), [airportSearchResults]);

  const flightState = useFlightLookup(flightNumber);
  const { state: globalState, search: searchGlobal, reset: resetGlobal } = useGlobalFlightSearch();

  // Resolved raw flight (local takes priority over global)
  const rawFlight = flightState.status === 'found' ? flightState.data
                  : globalState.status === 'found' ? globalState.data
                  : null;

  // Effective destination accounting for the swap toggle
  const effectiveDest: Destination | null = useMemo(() => {
    if (!rawFlight) return null;
    if (!flightSwapped) return rawFlight.destination;
    const originAirport = airports.find((a) => a.iata === rawFlight.origin.iata);
    return {
      iata: rawFlight.origin.iata,
      city: rawFlight.origin.city,
      country: originAirport?.country ?? '—',
      schengen: originAirport?.inSchengen ?? false,
    };
  }, [rawFlight, flightSwapped]);

  // Helper: register an airport in the dynamic list and set it as active
  const applyAirport = (iata: string, nameHint: string, cityHint: string, countryHint: string, schengenHint: boolean) => {
    const meta = AIRPORT_META[iata];
    if (!PINNED_IATAS.has(iata)) {
      const ap: Airport = {
        iata,
        name: meta?.city ?? nameHint,
        city: meta?.city ?? cityHint,
        country: meta?.country ?? countryHint,
        terminal: '',
        inSchengen: meta?.inSchengen ?? schengenHint,
      };
      setDynamicAirports((prev) => prev.some((a) => a.iata === iata) ? prev : [...prev, ap]);
    }
    setAirportIata(iata);
  };

  // Auto-set airport from flight origin when user hasn't manually chosen one.
  // Also auto-detects direction: if the resolved airport matches the flight's
  // destination (not origin), the user is on a return leg — auto-flip direction.
  useEffect(() => {
    const raw = flightState.status === 'found' ? flightState.data
              : globalState.status === 'found' ? globalState.data
              : null;

    if (raw) {
      if (!airportManuallySet) {
        // No manual airport: set from flight origin (respecting any existing swap)
        const effectiveOriginIata = flightSwapped ? raw.destination.iata : raw.origin.iata;
        applyAirport(
          effectiveOriginIata,
          flightSwapped ? raw.destination.city : raw.origin.name,
          flightSwapped ? raw.destination.city : raw.origin.city,
          flightSwapped ? raw.destination.country : '',
          flightSwapped ? raw.destination.schengen : false,
        );
      } else {
        // Airport was manually set — detect if user is actually at the destination
        // (return flight) and auto-flip direction if so.
        const currentIata = airportIata ?? '';
        if (currentIata && currentIata === raw.destination.iata && currentIata !== raw.origin.iata) {
          setFlightSwapped(true);
        } else if (currentIata && currentIata === raw.origin.iata) {
          setFlightSwapped(false);
        }
      }
    } else if (flightState.status === 'loading' && !airportManuallySet) {
      const hub = AIRLINE_HUB[airlineCode];
      if (hub) setAirportIata(hub);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightState, globalState, airlineCode, airportManuallySet]);

  const activeIata = airportIata ?? '';
  const airportDests = destinationsByAirport[activeIata] ?? [];

  const destinationOptions = useMemo(
    () => airportDests.map((d) => ({
      value: d.iata,
      label: d.city,
      sublabel: `${d.country} · ${d.schengen ? 'Schengen' : 'Non-Schengen'}`,
    })),
    [airportDests],
  );

  const resolvedDest: Destination | null = useMemo(() => {
    if (effectiveDest) return effectiveDest;
    if (manualDestIata) return airportDests.find((d) => d.iata === manualDestIata) ?? null;
    return null;
  }, [effectiveDest, manualDestIata, airportDests]);

  const area: 'schengen' | 'non-schengen' | 'both' = useMemo(() => {
    if (resolvedDest) {
      // Non-Schengen airports (HKG, SIN, JFK, DXB, etc.) have no Schengen/non-Schengen
      // split — all their departures are international. Using the destination's Schengen
      // status here would wrongly block non-Schengen lounges when flying to HEL.
      if (airport && !airport.inSchengen) return 'non-schengen';
      // Schengen airport: area depends on whether the destination is within the zone
      return resolvedDest.schengen ? 'schengen' : 'non-schengen';
    }
    return manualArea;
  }, [resolvedDest, manualArea, airport]);

  const departureZone: 'schengen' | 'non-schengen' | 'international' =
    area === 'both' ? 'international' : area;

  // AI lounge lookup — fires whenever airport, credentials, carrier, or departure zone change
  const aiState = useAILounges({
    airportIata,
    airportName:          airport?.name ?? null,
    airline:              rawFlight?.airline ?? undefined,
    operatingCarrierCode: airlineCode || null,
    card,
    status,
    departureZone,
    destination: resolvedDest?.city ?? undefined,
    gate:        gateInput || undefined,
  });

  // Fast Track eligibility: airline status OR credit card perk
  const hasFastTrack = useMemo(
    () =>
      (!!status && status.accessMethods.some((m) => FAST_TRACK_TIERS.has(m))) ||
      !!card?.fastTrack,
    [status, card],
  );
  const fastTrackReasons = useMemo(() => {
    const reasons: string[] = [];
    if (status && status.accessMethods.some((m) => FAST_TRACK_TIERS.has(m))) reasons.push(status.name);
    if (card?.fastTrack) reasons.push(card.name);
    return reasons;
  }, [status, card]);

  const chatContext = useMemo<ChatContext>(() => ({
    airport:     airport?.name ?? null,
    airportIata: airportIata ?? null,
    gate:        gateInput || null,
    cardName:    card?.name ?? null,
    statusName:  status?.name ?? null,
    flightNumber: flightNumber || null,
    destination: resolvedDest?.city ?? null,
    area:        area === 'both' ? null : area,
    fastTrack:   hasFastTrack,
    lounges:     aiState.phase === 'done'
      ? aiState.lounges.map((l) => ({ name: l.name, reason: l.accessMethod, accessible: true, tier: l.tier, amenities: l.amenities }))
      : [],
    allianceAccess: null,
  }), [airport, airportIata, gateInput, card, status, flightNumber, resolvedDest, area, hasFastTrack, aiState]);

  const historicalGate = rawFlight?.previousGate ?? null;

  // Auto-fill gate from historical data when a flight resolves, unless user typed one already
  useEffect(() => {
    if (!gateManuallySet && historicalGate) {
      setGateInput(historicalGate);
    }
  }, [historicalGate, gateManuallySet]);

  const hasInput        = !!(card || status || flightNumber);
  const isLoading       = flightState.status === 'loading';
  const isGlobalLoading = globalState.status === 'loading';

  // Use "International" for airports outside Schengen Europe; use Schengen/Non-Schengen for European ones
  const areaLabel = airport && !airport.inSchengen
    ? 'International'
    : area === 'schengen' ? 'Schengen'
    : area === 'non-schengen' ? 'Non-Schengen'
    : null;

  // The badge shown on the flight card — reflects the departure terminal zone, not the destination
  const departureZoneBadge = airport && !airport.inSchengen
    ? { label: getRegionLabel(activeIata), classes: 'bg-purple-500/15 text-purple-400' }
    : effectiveDest?.schengen
      ? { label: 'Schengen', classes: 'bg-teal-500/15 text-teal-400' }
      : effectiveDest
        ? { label: 'Non-Schengen', classes: 'bg-purple-500/15 text-purple-400' }
        : null;

  const localNotFound   = flightState.status === 'not-found' || flightState.status === 'error';
  const showSearchBtn   = localNotFound && flightNumber.trim().length >= 3 && globalState.status === 'idle';
  const showManualDest  = localNotFound && globalState.status !== 'found';
  const showManualArea  = flightNumber.trim().length < 3;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Global Airport Guide</h1>
            <p className="text-slate-400 text-xs">
              {airport ? `${airport.name} · ${airport.city}` : 'Select an airport to begin'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {airport && (
              <div className="text-right">
                <div className="text-xs text-slate-400">{airport.terminal}</div>
                <div className="text-xs text-blue-400 font-medium">IATA: {airport.iata}</div>
              </div>
            )}
            {hydrated && !effectiveFlightKey && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 hidden sm:inline">
                Demo
              </span>
            )}
            {hydrated && (
              <Settings onKeyChange={setFlightApiKey} serverHasKey={serverHasFlightKey} />
            )}
          </div>
        </div>
      </header>

      {/* Welcome banner — shown when we know the card and destination */}
      {hydrated && card && resolvedDest && (
        <div className="border-b border-slate-800 bg-blue-600/10">
          <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center gap-2">
            <span className="text-blue-400 text-sm">👋</span>
            <p className="text-blue-300 text-sm">
              Welcome back
              {card ? `, ${card.name.split(' ').slice(-1)[0]} holder` : ''}!
              {resolvedDest ? ` Ready for your flight to ${resolvedDest.city}?` : ''}
            </p>
          </div>
        </div>
      )}

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Inputs */}
        <section className="space-y-5">

          {/* ── 1. Identity ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Your Identity</h2>

            <SelectInput
              label="Credit Card"
              placeholder="Select your card…"
              options={cardOptions}
              value={cardId}
              onChange={setCardId}
              icon="💳"
            />

            <SelectInput
              label="Airline Status"
              placeholder="Select your status…"
              options={statusOptions}
              value={statusId}
              onChange={setStatusId}
              icon="✈️"
            />
          </div>

          {/* ── 2. Flight ────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Your Flight</h2>

            {/* Flight number input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                <span className="mr-1">🔢</span>Flight Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={flightNumber}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFlightNumber(val);
                    setManualDestIata(null);
                    resetGlobal();
                    setFlightSwapped(false);
                    setGateManuallySet(false);
                    setGateInput('');
                  }}
                  placeholder="e.g. AY121, BA001, KL601"
                  maxLength={8}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors pr-36"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium">
                  {isLoading && (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Looking up…
                    </span>
                  )}
                  {isGlobalLoading && (
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Searching…
                    </span>
                  )}
                  {flightState.status === 'found' && (
                    <span className="text-emerald-400">{flightState.data.airline}</span>
                  )}
                  {globalState.status === 'found' && (
                    <span className="text-blue-400">{globalState.data.airline}</span>
                  )}
                  {localNotFound && globalState.status === 'idle' && flightNumber.length >= 3 && (
                    <span className="text-slate-500">Not in local DB</span>
                  )}
                  {localNotFound && globalState.status === 'not-found' && (
                    <span className="text-slate-500">Not found</span>
                  )}
                </span>
              </div>
            </div>

            {/* Search global database button */}
            {showSearchBtn && (
              <button
                onClick={() => searchGlobal(flightNumber, effectiveFlightKey)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-600/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Global Database
                {!effectiveFlightKey && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 ml-1">
                    Demo
                  </span>
                )}
              </button>
            )}

            {/* Flight info card */}
            {rawFlight && effectiveDest && (
              <div className={`rounded-xl px-4 py-3 border ${
                globalState.status === 'found'
                  ? 'bg-slate-800/60 border-blue-500/20'
                  : 'bg-slate-800/60 border-slate-700/50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 text-xl">
                    {globalState.status === 'found' ? '🌐' : '🛬'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">
                      {flightSwapped ? rawFlight.destination.city : rawFlight.origin.city}
                      {' → '}
                      {flightSwapped ? rawFlight.origin.city : rawFlight.destination.city}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {effectiveDest.country} · Dep {rawFlight.departureTime} · {rawFlight.aircraft}
                    </p>
                  </div>
                  <div className="ml-auto shrink-0 flex flex-col items-end gap-1">
                    {departureZoneBadge && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${departureZoneBadge.classes}`}>
                        {departureZoneBadge.label}
                      </span>
                    )}
                    {'confidence' in rawFlight && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        rawFlight.confidence === 'confirmed'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}>
                        {rawFlight.confidence === 'confirmed' ? 'Confirmed' : 'Estimated'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newSwapped = !flightSwapped;
                    setFlightSwapped(newSwapped);
                    setAirportManuallySet(false); // let the effect re-apply the correct origin
                    if (rawFlight) {
                      // Immediately switch to the new departure airport
                      if (newSwapped) {
                        applyAirport(
                          rawFlight.destination.iata,
                          rawFlight.destination.city,
                          rawFlight.destination.city,
                          rawFlight.destination.country,
                          rawFlight.destination.schengen,
                        );
                      } else {
                        applyAirport(
                          rawFlight.origin.iata,
                          rawFlight.origin.name,
                          rawFlight.origin.city,
                          '',
                          false,
                        );
                      }
                    }
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  {flightSwapped ? 'Restore original direction' : "Swap — I'm departing the other way"}
                </button>
              </div>
            )}

            {/* Manual destination fallback */}
            {showManualDest && activeIata && (
              <SelectInput
                label="Destination (not found — select manually)"
                placeholder="Select your destination…"
                options={destinationOptions}
                value={manualDestIata}
                onChange={setManualDestIata}
                icon="🛬"
              />
            )}

            {/* Manual area — only when no flight number entered */}
            {showManualArea && (
              <SelectInput
                label="Destination Area"
                placeholder="Show all lounges"
                options={areaOptions}
                value={manualArea}
                onChange={(v) => setManualArea(v ?? 'both')}
                icon="🌍"
              />
            )}
          </div>

          {/* ── 3. Location (confirmation fields) ───────────────────────── */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Current Location</h2>

            <SelectInput
              label="Airport"
              placeholder="Auto-detected from flight, or search worldwide…"
              options={airportOptions}
              value={airportIata}
              onChange={(v) => {
                // If selected from global search results, persist to dynamic list
                if (v) {
                  const fromSearch = airportSearchResults.find((a) => a.iata === v);
                  if (fromSearch && !PINNED_IATAS.has(v)) {
                    setDynamicAirports((prev) =>
                      prev.some((a) => a.iata === v) ? prev : [...prev, fromSearch],
                    );
                  }
                }
                setAirportIata(v);
                setAirportManuallySet(true);
              }}
              icon="🏛️"
              onSearch={effectiveFlightKey ? searchAirports : undefined}
              asyncOptions={airportSearchOptions}
              isSearching={airportSearchLoading}
            />

            {/* Gate number */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                <span className="mr-1">🚪</span>Gate Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={gateInput}
                  onChange={(e) => {
                    setGateInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    setGateManuallySet(true);
                  }}
                  placeholder="e.g. 36 or B14"
                  maxLength={4}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              {historicalGate && (
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Yesterday this flight departed from Gate {historicalGate}
                </p>
              )}
            </div>
          </div>

        </section>

        {/* Results */}
        {hasInput && airportIata && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Access Summary
              </h2>
              {areaLabel && (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    area === 'schengen'
                      ? 'bg-teal-500/15 text-teal-400'
                      : 'bg-purple-500/15 text-purple-400'
                  }`}
                >
                  {areaLabel} only
                </span>
              )}
            </div>

            <FastTrackStatus hasFastTrack={hasFastTrack} reasons={fastTrackReasons} />

            {/* AI lounge states */}
            {(aiState.phase === 'fetching' || aiState.phase === 'verifying') && (
              <div className="space-y-3">
                <div className="rounded-2xl border p-5 bg-slate-800/60 border-slate-700/60">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                    </span>
                    <span className="text-sm text-slate-300 font-medium">
                      {aiState.phase === 'fetching' ? 'Checking lounge access…' : 'Verifying access rules…'}
                    </span>
                  </div>
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-slate-700/60 rounded-full w-3/4" />
                    <div className="h-3 bg-slate-700/40 rounded-full w-1/2" />
                    <div className="flex gap-1.5 mt-3">
                      <div className="h-6 bg-slate-700/40 rounded-full w-16" />
                      <div className="h-6 bg-slate-700/40 rounded-full w-20" />
                      <div className="h-6 bg-slate-700/40 rounded-full w-14" />
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border p-5 bg-slate-800/40 border-slate-700/40 animate-pulse opacity-50">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-700/60 rounded-full w-2/3" />
                    <div className="h-3 bg-slate-700/40 rounded-full w-1/3" />
                  </div>
                </div>
              </div>
            )}

            {aiState.phase === 'error' && (
              <div className="rounded-2xl bg-slate-800/60 border border-red-500/20 p-6 text-center">
                <div className="text-3xl mb-2">⚠️</div>
                <p className="text-slate-300 font-medium">Could not load lounge data</p>
                <p className="text-slate-500 text-sm mt-1">{aiState.message}</p>
                <button
                  onClick={aiState.refetch}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}

            {aiState.phase === 'done' && aiState.lounges.length === 0 && (
              <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-6 text-center">
                <div className="text-3xl mb-2">🚫</div>
                <p className="text-slate-300 font-medium">No lounge access found</p>
                <p className="text-slate-500 text-sm mt-1">
                  Try adding a Priority Pass card or a qualifying airline status
                </p>
              </div>
            )}

            {aiState.phase === 'done' && aiState.lounges.length > 0 && (
              <div className="space-y-3">
                {aiState.lounges.map((l, i) => (
                  <AILoungeCard key={l.id} lounge={l} isBest={i === 0} />
                ))}
                {aiState.notes && (
                  <p className="text-xs text-slate-500 px-1">{aiState.notes}</p>
                )}
              </div>
            )}

            {card?.guestPolicy && (
              <p className="text-xs text-slate-500 px-1">
                <span className="text-slate-400 font-medium">Guest policy: </span>
                {card.guestPolicy}
              </p>
            )}

            <TravelAssistant context={chatContext} />
          </section>
        )}

        {/* Airport not yet selected prompt */}
        {hasInput && !airportIata && (
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-6 text-center">
            <div className="text-3xl mb-2">🏛️</div>
            <p className="text-slate-300 font-medium">Select an airport</p>
            <p className="text-slate-500 text-sm mt-1">Choose your departure airport above to see lounge recommendations</p>
          </div>
        )}

        {!hasInput && (
          <section className="pt-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm">
              Select an airport, then enter your card, status, or flight number to see lounge access and Fast Track eligibility.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
