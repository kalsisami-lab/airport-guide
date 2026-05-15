import type { AllianceAccess } from '@/lib/eligibility';

const ALLIANCE_META = {
  oneworld: {
    name: 'oneworld',
    partners: ['Cathay Pacific (CX)', 'British Airways (BA)', 'Qantas (QF)', 'American Airlines (AA)', 'Japan Airlines (JL)', 'Iberia (IB)'],
    bg: 'bg-red-950/40',
    border: 'border-red-500/25',
    badgeClasses: 'bg-red-500/15 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
  },
  'star-alliance': {
    name: 'Star Alliance',
    partners: ['Lufthansa (LH)', 'United Airlines (UA)', 'Singapore Airlines (SQ)', 'Turkish Airlines (TK)', 'ANA (NH)', 'Air Canada (AC)'],
    bg: 'bg-amber-950/30',
    border: 'border-amber-500/25',
    badgeClasses: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  skyteam: {
    name: 'SkyTeam',
    partners: ['Air France (AF)', 'KLM (KL)', 'Delta Air Lines (DL)', 'Korean Air (KE)', 'China Eastern (MU)'],
    bg: 'bg-cyan-950/30',
    border: 'border-cyan-500/25',
    badgeClasses: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
} as const;

const TIER_STYLE: Record<string, { isFirst: boolean; loungeAccess: string; tierBadge: string; tierBadgeLabel: string }> = {
  Emerald:    { isFirst: true,  loungeAccess: 'First + Business Class lounges', tierBadge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', tierBadgeLabel: 'Platinum Wing' },
  Sapphire:   { isFirst: false, loungeAccess: 'Business Class lounges',         tierBadge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',   tierBadgeLabel: 'Premium' },
  Gold:       { isFirst: false, loungeAccess: 'Business Class lounges',         tierBadge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',   tierBadgeLabel: 'Premium' },
  'Elite Plus': { isFirst: false, loungeAccess: 'Business Class lounges',       tierBadge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',   tierBadgeLabel: 'Premium' },
};

type Props = {
  access: AllianceAccess;
  iataCode: string;
  gateLabel?: string;
};

export default function GlobalAllianceCard({ access, iataCode, gateLabel }: Props) {
  const meta = ALLIANCE_META[access.alliance];
  const tier = TIER_STYLE[access.tier] ?? TIER_STYLE['Gold'];

  const amenities = [
    tier.isFirst ? 'First Class Access' : null,
    'Business Class Access',
    '1,000+ airports worldwide',
    'Show status card at reception',
  ].filter(Boolean) as string[];

  return (
    <div className={`rounded-2xl border p-5 ${meta.bg} ${meta.border}`}>
      {tier.isFirst && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Best Alliance Access</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-white font-semibold text-base leading-tight">
            {meta.name} {access.tier} Access
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {iataCode} · {tier.loungeAccess}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${tier.tierBadge}`}>
          {tier.tierBadgeLabel}
        </span>
      </div>

      <p className="text-slate-400 text-sm mb-4 leading-relaxed">{access.message}</p>

      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
          Look for partner lounges from
        </p>
        <div className="flex flex-wrap gap-1.5">
          {meta.partners.map((p) => (
            <span key={p} className="text-xs bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-full">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {amenities.map((a) => (
          <span key={a} className="text-xs bg-slate-800/80 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700/50">
            {a}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 border-t border-slate-700/50 pt-3">
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          Alliance lounge
        </span>

        {gateLabel && (
          <span className="flex items-center gap-1 text-sky-400 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            ~5–10 min from Gate {gateLabel}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1.5">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${meta.badgeClasses}`}>
            {meta.name} {access.tier}
          </span>
          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
