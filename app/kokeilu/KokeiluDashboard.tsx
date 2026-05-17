'use client';

import { useState } from 'react';

// ─── Static list of known status programmes + tiers (mirrors seed data) ────────

const PROGRAMMES: { code: string; label: string; tiers: string[] }[] = [
  { code: 'ay-plus',        label: 'Finnair Plus',               tiers: ['Silver', 'Gold', 'Platinum'] },
  { code: 'ba-exec-club',   label: 'BA Executive Club',          tiers: ['Silver', 'Gold'] },
  { code: 'ib-plus',        label: 'Iberia Plus',                tiers: ['Silver', 'Gold', 'Platinum'] },
  { code: 'qr-privilege',   label: 'Qatar Privilege Club',       tiers: ['Silver', 'Gold', 'Platinum'] },
  { code: 'jl-mileage',     label: 'JAL Mileage Bank',          tiers: ['JGC Regular', 'JGC Premier'] },
  { code: 'lh-miles-more',  label: 'Miles & More',               tiers: ['Frequent Traveller', 'Senator', 'HON Circle Member'] },
  { code: 'lx-miles-more',  label: 'Miles & More (Swiss)',       tiers: ['Senator'] },
  { code: 'ua-mileageplus', label: 'United MileagePlus',         tiers: ['Premier Silver', 'Gold', 'Premier Platinum', '1K'] },
  { code: 'nh-amc',         label: 'ANA Mileage Club',           tiers: ['Star', 'Super Flyers'] },
  { code: 'af-flying-blue', label: 'Air France Flying Blue',     tiers: ['Silver', 'Gold', 'Platinum'] },
  { code: 'kl-flying-blue', label: 'KLM Flying Blue',            tiers: ['Silver', 'Gold', 'Platinum'] },
  { code: 'dl-skymiles',    label: 'Delta SkyMiles',             tiers: ['Silver', 'Gold', 'Platinum'] },
  { code: 'ek-skywards',    label: 'Emirates Skywards',          tiers: ['Silver', 'Gold'] },
];

// ─── Result types (mirrors AirportEntitlements JSON) ──────────────────────────

interface AccessResult {
  status: string;
  confidence: number;
  reason: string;
  guest_allowed: boolean;
  source: string;
}

interface LoungeEntitlement {
  lounge: {
    id: number;
    name: string;
    terminalId: number | null;
    openingHours: string | null;
    tier: string;
    loungeClass: string;
    locationDescription: string | null;
    amenities: string[] | null;
  };
  access: AccessResult;
}

interface EntitlementResult {
  passenger: {
    operatingCarrier: string;
    operatingAlliance: string | null;
    cabin: string;
    departureAirport: string;
    arrivalAirport: string;
  };
  status: {
    allianceTier: string;
    programCode: string;
    tierName: string;
    fastTrack: boolean;
  } | null;
  lounges: LoungeEntitlement[];
  fastTrack: {
    available: boolean;
    confidence: number;
    reason: string;
  };
  evaluatedAt: string;
}

// ─── Status + tier styling ────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  allowed:               { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', label: 'Allowed' },
  likely_allowed:        { bg: 'bg-yellow-500/15',  text: 'text-yellow-300',  border: 'border-yellow-500/30',  label: 'Likely allowed' },
  not_enough_info:       { bg: 'bg-orange-500/15',  text: 'text-orange-300',  border: 'border-orange-500/30',  label: 'Not enough info' },
  paid_available:        { bg: 'bg-blue-500/15',    text: 'text-blue-300',    border: 'border-blue-500/30',    label: 'Paid access' },
  physically_unreachable:{ bg: 'bg-purple-500/15',  text: 'text-purple-300',  border: 'border-purple-500/30',  label: 'Wrong terminal' },
  closed:                { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/30',   label: 'Closed' },
  denied:                { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20',     label: 'Denied' },
};

const TIER_LABEL: Record<string, string> = {
  ultra_premium: 'First',
  premium:       'Business',
  standard:      'Standard',
};

const ALLIANCE_LABEL: Record<string, string> = {
  oneworld:      'oneworld',
  star_alliance: 'Star Alliance',
  skyteam:       'SkyTeam',
};

const TIER_COLOR: Record<string, string> = {
  oneworld_emerald:   'text-red-400',
  oneworld_sapphire:  'text-red-300',
  oneworld_ruby:      'text-rose-300',
  star_gold:          'text-amber-300',
  star_silver:        'text-slate-300',
  skyteam_elite_plus: 'text-cyan-300',
  skyteam_elite:      'text-cyan-400',
  none:               'text-slate-400',
};

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  departureAirport: string;
  arrivalAirport: string;
  operatingCarrier: string;
  cabin: 'economy' | 'business' | 'first';
  terminalId: string;
  programCode: string;
  tierName: string;
}

function defaultForm(): FormState {
  return {
    departureAirport: 'HEL',
    arrivalAirport:   'FRA',
    operatingCarrier: 'AY',
    cabin:            'economy',
    terminalId:       '',
    programCode:      'ay-plus',
    tierName:         'Gold',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KokeiluDashboard() {
  const [form, setForm]       = useState<FormState>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<EntitlementResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const selectedProg = PROGRAMMES.find((p) => p.code === form.programCode);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'programCode') {
        const prog = PROGRAMMES.find((p) => p.code === String(v));
        next.tierName = prog?.tiers[0] ?? '';
      }
      return next;
    });
  }

  async function evaluate() {
    setLoading(true);
    setError(null);
    setResult(null);

    const body = {
      flight: {
        operatingCarrier:  form.operatingCarrier.toUpperCase(),
        cabin:             form.cabin,
        departureAirport:  form.departureAirport.toUpperCase(),
        arrivalAirport:    form.arrivalAirport.toUpperCase(),
        ...(form.terminalId ? { departureTerminalId: Number(form.terminalId) } : {}),
      },
      user: {
        statusCards: form.programCode
          ? [{ programCode: form.programCode, tierName: form.tierName }]
          : [],
      },
    };

    try {
      const res = await fetch('/api/entitlements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError((e as { error?: string }).error ?? `HTTP ${res.status}`);
      } else {
        setResult(await res.json());
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">⚗</span>
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Kokeilu — New Entitlement Engine</h1>
          <p className="text-xs text-slate-500">Experimental · SQLite-backed · Separate from production</p>
        </div>
        <a href="/" className="ml-auto text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
          ← Main app
        </a>
      </div>

      {/* Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <Field label="Departure airport">
            <input
              className="input"
              value={form.departureAirport}
              onChange={(e) => set('departureAirport', e.target.value.toUpperCase())}
              placeholder="HEL"
              maxLength={3}
            />
          </Field>
          <Field label="Arrival airport">
            <input
              className="input"
              value={form.arrivalAirport}
              onChange={(e) => set('arrivalAirport', e.target.value.toUpperCase())}
              placeholder="FRA"
              maxLength={3}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Operating carrier">
            <input
              className="input"
              value={form.operatingCarrier}
              onChange={(e) => set('operatingCarrier', e.target.value.toUpperCase())}
              placeholder="AY"
              maxLength={3}
            />
          </Field>
          <Field label="Cabin">
            <select className="input" value={form.cabin} onChange={(e) => set('cabin', e.target.value as FormState['cabin'])}>
              <option value="economy">Economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </Field>
        </div>

        <Field label="Departure terminal (optional)">
          <input
            className="input"
            value={form.terminalId}
            onChange={(e) => set('terminalId', e.target.value)}
            placeholder="e.g. 2"
            maxLength={2}
          />
        </Field>

        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-3">
          <Field label="Status programme">
            <select
              className="input"
              value={form.programCode}
              onChange={(e) => set('programCode', e.target.value)}
            >
              <option value="">— No status card —</option>
              {PROGRAMMES.map((p) => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Tier">
            <select
              className="input"
              value={form.tierName}
              onChange={(e) => set('tierName', e.target.value)}
              disabled={!form.programCode}
            >
              {selectedProg?.tiers.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <button
          onClick={evaluate}
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {loading ? 'Evaluating…' : 'Evaluate entitlements'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && <Results result={result} />}

      <style jsx>{`
        .input {
          width: 100%;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #f1f5f9;
          outline: none;
        }
        .input:focus {
          border-color: #3b82f6;
        }
        .input:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      {children}
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results({ result }: { result: EntitlementResult }) {
  const { passenger, status, lounges, fastTrack } = result;

  const allowedCount  = lounges.filter((l) => l.access.status === 'allowed').length;
  const likelyCount   = lounges.filter((l) => l.access.status === 'likely_allowed').length;
  const deniedCount   = lounges.filter((l) => l.access.status === 'denied').length;
  const closedCount   = lounges.filter((l) => l.access.status === 'closed').length;

  return (
    <div className="space-y-4">

      {/* Summary bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">

        {/* Passenger line */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-200">
            {passenger.departureAirport} → {passenger.arrivalAirport}
          </span>
          <Pill>{passenger.operatingCarrier}</Pill>
          <Pill>{passenger.cabin}</Pill>
          {passenger.operatingAlliance && (
            <Pill>{ALLIANCE_LABEL[passenger.operatingAlliance] ?? passenger.operatingAlliance}</Pill>
          )}
        </div>

        {/* Status line */}
        {status ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Status:</span>
            <span className={`text-sm font-medium ${TIER_COLOR[status.allianceTier] ?? 'text-slate-300'}`}>
              {status.allianceTier}
            </span>
            <span className="text-xs text-slate-500">via {status.programCode} {status.tierName}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">No status card</span>
        )}

        {/* Fast track */}
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
            fastTrack.available
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-700/30 text-slate-500 border-slate-700'
          }`}>
            {fastTrack.available ? '⚡ Fast Track available' : 'No fast track'}
          </span>
          {fastTrack.reason && (
            <span className="text-xs text-slate-500">{fastTrack.reason}</span>
          )}
        </div>
      </div>

      {/* Lounge stats */}
      <div className="flex gap-3 text-xs text-slate-500">
        <span>{lounges.length} lounges evaluated</span>
        {allowedCount > 0 && <span className="text-emerald-400">{allowedCount} allowed</span>}
        {likelyCount  > 0 && <span className="text-yellow-400">{likelyCount} likely</span>}
        {closedCount  > 0 && <span>{closedCount} closed</span>}
        {deniedCount  > 0 && <span className="text-red-400">{deniedCount} denied</span>}
      </div>

      {/* Lounge cards */}
      {lounges.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8">
          No lounge data for this airport
        </div>
      ) : (
        <div className="space-y-2">
          {lounges.map((entry) => (
            <LoungeCard key={entry.lounge.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LoungeCard ───────────────────────────────────────────────────────────────

function LoungeCard({ entry }: { entry: LoungeEntitlement }) {
  const { lounge, access } = entry;
  const style = STATUS_STYLE[access.status] ?? STATUS_STYLE.denied;

  return (
    <div className={`rounded-xl border p-4 ${style.border} bg-slate-900/60`}>
      <div className="flex items-start gap-3">

        {/* Status dot */}
        <span className={`mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border} shrink-0`}>
          {style.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-slate-100 leading-tight">
              {lounge.name}
            </span>
            <span className="text-xs text-slate-500 shrink-0">
              {Math.round(access.confidence * 100)}%
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {lounge.tier && (
              <span className="text-xs text-slate-500">{TIER_LABEL[lounge.tier] ?? lounge.tier}</span>
            )}
            {lounge.terminalId && (
              <span className="text-xs text-slate-600">T{lounge.terminalId}</span>
            )}
            {lounge.openingHours && (
              <span className="text-xs text-slate-600">{lounge.openingHours}</span>
            )}
          </div>

          {lounge.locationDescription && (
            <p className="text-xs text-slate-600 mt-1 truncate">{lounge.locationDescription}</p>
          )}

          <p className="text-xs text-slate-400 mt-1.5 italic">{access.reason}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
      {children}
    </span>
  );
}
