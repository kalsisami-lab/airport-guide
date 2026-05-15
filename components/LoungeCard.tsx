import type { EligibleLounge } from '@/lib/eligibility';
import type { WalkResult } from '@/lib/walkingTime';
import { piersByAirport } from '@/data/gates';

const TIER_STYLES = {
  'ultra-premium': {
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    ring: 'ring-1 ring-amber-500/30',
    label: 'Platinum Wing',
    dot: 'bg-amber-400',
  },
  premium: {
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    ring: 'ring-1 ring-blue-500/20',
    label: 'Premium',
    dot: 'bg-blue-400',
  },
  standard: {
    badge: 'bg-slate-600/50 text-slate-300 border border-slate-600',
    ring: '',
    label: 'Standard',
    dot: 'bg-slate-400',
  },
  restaurant: {
    badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    ring: 'ring-1 ring-rose-500/20',
    label: 'Restaurant',
    dot: 'bg-rose-400',
  },
};

// Colored pill for each access method — shows WHY the user has access
const ACCESS_BADGE: Record<string, { label: string; classes: string }> = {
  'oneworld-emerald':      { label: 'oneworld Emerald',    classes: 'bg-red-500/15 text-red-300 border-red-500/30' },
  'oneworld-sapphire':     { label: 'oneworld Sapphire',   classes: 'bg-red-500/10 text-red-300 border-red-500/20' },
  'finnair-plus-platinum': { label: 'Finnair Platinum',    classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  'finnair-plus-gold':     { label: 'Finnair Gold',        classes: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  'star-alliance-gold':    { label: 'Star Alliance Gold',  classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  'skyteam-elite-plus':    { label: 'SkyTeam Elite+',      classes: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  'priority-pass':         { label: 'Priority Pass',       classes: 'bg-slate-600/40 text-slate-300 border-slate-600/50' },
  'lounge-key':            { label: 'LoungeKey',           classes: 'bg-slate-600/40 text-slate-300 border-slate-600/50' },
  'dragon-pass':           { label: 'DragonPass',          classes: 'bg-slate-600/40 text-slate-300 border-slate-600/50' },
  'amex-platinum':         { label: 'Amex Platinum',       classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  'op-card':               { label: 'OP Card',             classes: 'bg-green-500/15 text-green-300 border-green-500/30' },
  'business-class':        { label: 'Business Class',      classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  'first-class':           { label: 'First Class',         classes: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
};

const AREA_LABEL: Record<string, string> = {
  schengen: 'Schengen',
  'non-schengen': 'Non-Schengen',
};

type Props = {
  eligible: EligibleLounge;
  isBest?: boolean;
  walkResult?: WalkResult;
  gateLabel?: string;
  airportIata?: string;
};

export default function LoungeCard({ eligible, isBest, walkResult, gateLabel, airportIata }: Props) {
  const { lounge, reason, areaMatch } = eligible;
  const style = TIER_STYLES[lounge.tier];
  const badge = ACCESS_BADGE[eligible.accessMethod];

  const gateRange = (() => {
    if (!airportIata || !lounge.pier) return null;
    const cfg = (piersByAirport[airportIata] ?? []).find((p) => p.pier === lounge.pier);
    if (!cfg) return null;
    return `Gates ${cfg.min}–${cfg.max}`;
  })();

  return (
    <div
      className={`rounded-2xl border p-5 transition-opacity ${
        areaMatch
          ? `bg-slate-800/60 border-slate-700/60 ${style.ring} ${isBest ? 'border-amber-500/40' : ''}`
          : 'bg-slate-800/30 border-slate-700/30 opacity-60'
      }`}
    >
      {/* Out-of-area notice */}
      {!areaMatch && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-slate-700/40 border border-slate-600/40">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-slate-400 text-xs">
            {lounge.area === 'non-schengen' ? 'Non-Schengen' : 'Schengen'} area — not accessible on this flight
          </span>
        </div>
      )}

      {lounge.keyBenefit && areaMatch && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-rose-300 text-xs font-medium">{lounge.keyBenefit}</span>
        </div>
      )}

      {isBest && areaMatch && !lounge.keyBenefit && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">
            Best Lounge
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-white font-semibold text-base leading-tight">{lounge.name}</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {lounge.terminal} · {lounge.location}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}>
          {style.label}
        </span>
      </div>

      <p className="text-slate-400 text-sm mb-4 leading-relaxed">{lounge.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {lounge.amenities.map((a) => (
          <span
            key={a}
            className="text-xs bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-full"
          >
            {a}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 border-t border-slate-700/50 pt-3">
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              lounge.area === 'non-schengen' ? 'bg-purple-400' : 'bg-teal-400'
            }`}
          />
          {AREA_LABEL[lounge.area]}
        </span>
        <span className="flex flex-col gap-0.5">
          <span>{lounge.hours}</span>
          <span className="text-slate-600 text-[10px]">Aukioloajat voivat vaihdella</span>
        </span>

        {gateRange && !walkResult && (
          <span className="flex items-center gap-1 text-slate-500">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {gateRange}
          </span>
        )}

        {walkResult && (
          walkResult.reachable ? (
            <span className="flex items-center gap-1 text-sky-400 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ~{walkResult.minutes} min walk{gateLabel ? ` from Gate ${gateLabel}` : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500" title={walkResult.reason}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {walkResult.reason}
            </span>
          )
        )}

        {/* Access method badge — shows WHY user has access */}
        <span className="ml-auto flex items-center gap-1.5">
          {badge ? (
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.classes}`}>
              {badge.label}
            </span>
          ) : (
            <span className="text-xs text-slate-400">{reason}</span>
          )}
          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
