import type { AILounge, AILoungeTier } from '@/lib/aiLounge';

const TIER_STYLES: Record<AILoungeTier, { badge: string; ring: string; label: string }> = {
  'ultra-premium': {
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    ring:  'ring-1 ring-amber-500/30',
    label: 'Platinum / First',
  },
  premium: {
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    ring:  'ring-1 ring-blue-500/20',
    label: 'Business',
  },
  standard: {
    badge: 'bg-slate-600/50 text-slate-300 border border-slate-600',
    ring:  '',
    label: 'Standard',
  },
};

type Props = {
  lounge: AILounge;
  isBest?: boolean;
};

export default function AILoungeCard({ lounge, isBest }: Props) {
  const style = TIER_STYLES[lounge.tier] ?? TIER_STYLES.standard;

  return (
    <div className={`rounded-2xl border p-5 bg-slate-800/60 border-slate-700/60 ${style.ring} ${isBest ? 'border-amber-500/40' : ''}`}>
      {isBest && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Best Lounge</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-base leading-tight">{lounge.name}</h3>
          <p className="text-slate-400 text-xs mt-0.5 truncate">{lounge.location}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}>
          {style.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {lounge.amenities.map((a) => (
          <span key={a} className="text-xs bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-full">
            {a}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 border-t border-slate-700/50 pt-3">
        <span className="flex flex-col gap-0.5">
          <span>{lounge.hours}</span>
          <span className="text-slate-600 text-[10px]">Aukioloajat voivat vaihdella</span>
        </span>

        {lounge.walkingInfo && (
          <span className="flex items-center gap-1 text-sky-400 font-medium">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {lounge.walkingInfo}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 max-w-[180px] truncate">
            {lounge.accessMethod}
          </span>
          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
