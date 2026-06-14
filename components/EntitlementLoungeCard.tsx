'use client';

import { useState } from 'react';
import type { LoungeEntitlement } from '@/lib/entitlements/types';
import type { AccessStatus } from '@/lib/engine/types';

// ─── Tier badges (same palette as AILoungeCard / LoungeCard) ─────────────────

const TIER_STYLES: Record<string, { badge: string; ring: string; label: string }> = {
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

// ─── Status → visual config ───────────────────────────────────────────────────

interface StatusStyle {
  cardCls:    string;  // extra border / bg modifiers for the card
  opacity:    string;
  checkColor: string;
  checkIcon:  'check' | 'info' | 'euro' | 'x' | 'terminal' | 'clock' | 'question';
}

const STATUS_STYLE: Record<AccessStatus, StatusStyle> = {
  allowed: {
    cardCls:    '',
    opacity:    '',
    checkColor: 'text-emerald-400',
    checkIcon:  'check',
  },
  likely_allowed: {
    cardCls:    '',
    opacity:    '',
    checkColor: 'text-blue-400',
    checkIcon:  'info',
  },
  paid_available: {
    cardCls:    'border-slate-700/40 bg-slate-800/40',
    opacity:    '',
    checkColor: 'text-slate-400',
    checkIcon:  'euro',
  },
  denied: {
    cardCls:    'border-slate-700/30 bg-slate-800/30',
    opacity:    'opacity-60',
    checkColor: 'text-slate-500',
    checkIcon:  'x',
  },
  physically_unreachable: {
    cardCls:    'border-slate-700/30 bg-slate-800/30',
    opacity:    'opacity-60',
    checkColor: 'text-slate-500',
    checkIcon:  'terminal',
  },
  closed: {
    cardCls:    'border-slate-700/30 bg-slate-800/30',
    opacity:    'opacity-60',
    checkColor: 'text-slate-500',
    checkIcon:  'clock',
  },
  not_offered_at_airport: {
    cardCls:    'border-slate-700/20 bg-slate-800/20',
    opacity:    'opacity-40',
    checkColor: 'text-slate-600',
    checkIcon:  'x',
  },
  not_enough_info: {
    cardCls:    'border-slate-700/40 bg-slate-800/40',
    opacity:    '',
    checkColor: 'text-slate-400',
    checkIcon:  'question',
  },
  not_applicable: {
    cardCls:    'border-slate-700/20 bg-slate-800/20',
    opacity:    'opacity-40',
    checkColor: 'text-slate-600',
    checkIcon:  'x',
  },
};

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function StatusIcon({ type, className }: { type: StatusStyle['checkIcon']; className: string }) {
  if (type === 'check') return (
    <svg className={`w-3.5 h-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
  if (type === 'info') return (
    <svg className={`w-3.5 h-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (type === 'euro') return (
    <span className={`text-xs font-bold shrink-0 ${className}`}>€</span>
  );
  if (type === 'x') return (
    <svg className={`w-3.5 h-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
  if (type === 'terminal') return (
    <svg className={`w-3.5 h-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
  if (type === 'clock') return (
    <svg className={`w-3.5 h-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  // question
  return (
    <svg className={`w-3.5 h-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ─── Status label ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Partial<Record<AccessStatus, string>> = {
  likely_allowed:         'Likely accessible',
  paid_available:         'Paid access available',
  denied:                 'No access',
  physically_unreachable: 'Different terminal',
  closed:                 'Currently closed',
  not_offered_at_airport: 'Not available here',
  not_enough_info:        'Access unconfirmed',
};

// ─── Area label ───────────────────────────────────────────────────────────────

const AREA_LABEL: Record<string, string> = {
  schengen:     'Schengen',
  non_schengen: 'Non-Schengen',
  international:'International',
  all:          '',
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  entitlement: LoungeEntitlement;
  isBest?: boolean;
  passengerTerminalId?: number;
};

export default function EntitlementLoungeCard({ entitlement, isBest, passengerTerminalId }: Props) {
  const [showReason, setShowReason] = useState(false);

  const { lounge, access } = entitlement;
  const style     = TIER_STYLES[lounge.tier] ?? TIER_STYLES.standard;
  const statusSty = STATUS_STYLE[access.status] ?? STATUS_STYLE.denied;

  const isAccessible = access.status === 'allowed' || access.status === 'likely_allowed';
  const isPaid       = access.status === 'paid_available';

  // Terminal reachability hint
  const differentTerminal =
    passengerTerminalId != null &&
    lounge.terminalId != null &&
    lounge.terminalId !== passengerTerminalId;

  // Source display: show when non-empty and not just "unknown"
  const sourceText = access.source && access.source !== 'unknown' ? access.source : null;

  // Parse "Verified MM/YYYY · domain" from source string if it contains a URL
  function formatSource(src: string): string {
    try {
      const url  = new URL(src);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return src.length > 40 ? src.slice(0, 40) + '…' : src;
    }
  }

  const defaultCardCls = `bg-slate-800/60 border-slate-700/60 ${style.ring}${isBest && isAccessible ? ' border-amber-500/40' : ''}`;
  const cardCls = statusSty.cardCls || defaultCardCls;

  return (
    <div className={`rounded-2xl border p-5 transition-opacity ${cardCls} ${statusSty.opacity}`}>

      {/* Best-lounge badge */}
      {isBest && isAccessible && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Best Lounge</span>
        </div>
      )}

      {/* Status notice for non-accessible lounges */}
      {!isAccessible && !isPaid && access.status !== 'not_offered_at_airport' && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-slate-700/40 border border-slate-600/40">
          <StatusIcon type={statusSty.checkIcon} className="text-slate-400" />
          <span className="text-slate-400 text-xs">
            {STATUS_LABEL[access.status] ?? access.status}
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-white font-semibold text-base leading-tight">{lounge.name}</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {lounge.locationDescription ?? ''}
            {lounge.terminalId != null && differentTerminal && (
              <span className="ml-1 text-amber-400/80">· Terminal {lounge.terminalId}</span>
            )}
          </p>
          {(lounge.area === 'schengen' || lounge.area === 'non_schengen') && (
            <span className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              lounge.area === 'schengen'
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
            }`}>
              {lounge.area === 'schengen' ? 'Schengen' : 'Non-Schengen'}
            </span>
          )}
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* Amenity chips */}
      {lounge.amenities && lounge.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {lounge.amenities.map((a) => (
            <span key={a} className="text-xs bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-full">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Reason expand panel */}
      {showReason && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-slate-700/30 border border-slate-600/30">
          <p className="text-slate-300 text-xs leading-relaxed">{access.reason}</p>
          {access.confidence < 1.0 && (
            <p className="text-slate-500 text-xs mt-1">
              Confidence: {Math.round(access.confidence * 100)}%
              {access.confidence < 0.8 && ' — rule data may be incomplete'}
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 border-t border-slate-700/50 pt-3">

        {/* Area badge */}
        {lounge.area && AREA_LABEL[lounge.area] && (
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${
              lounge.area === 'non_schengen' ? 'bg-purple-400' : 'bg-teal-400'
            }`} />
            {AREA_LABEL[lounge.area]}
          </span>
        )}

        {/* Opening hours */}
        {lounge.openingHours && (
          <span className="flex flex-col gap-0.5">
            <span>{lounge.openingHours}</span>
            <span className="text-slate-600 text-[10px]">Aukioloajat voivat vaihdella</span>
          </span>
        )}

        {/* Paid access note */}
        {isPaid && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-600/40 text-slate-300 border border-slate-600/50">
            € Paid access
          </span>
        )}

        {/* Guest note */}
        {access.guest_allowed && (
          <span className="text-xs text-slate-400">+1 guest</span>
        )}

        {/* Source line */}
        {sourceText && (
          <span className="text-slate-600 text-[10px]">
            · {formatSource(sourceText)}
          </span>
        )}

        {/* Right side: access label + tap-expand */}
        <span className="ml-auto flex items-center gap-1.5">
          {isAccessible && access.accessVia && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 max-w-[180px] truncate">
              {access.accessVia}
            </span>
          )}

          {/* Confidence indicator */}
          {access.confidence < 1.0 && isAccessible && (
            <button
              onClick={() => setShowReason(!showReason)}
              className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center hover:bg-amber-500/30 transition-colors"
              title="Show confidence details"
            >
              i
            </button>
          )}

          {/* Main status icon — tappable to show reason */}
          <button
            onClick={() => setShowReason(!showReason)}
            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            title="Show access reason"
          >
            <StatusIcon type={statusSty.checkIcon} className={statusSty.checkColor} />
          </button>
        </span>
      </div>
    </div>
  );
}
