import type { AccessResult, AccessStatus } from '@/lib/engine/types';
import type { ServiceType } from '@/lib/airport-services/types';

const SERVICE_META: Record<ServiceType, { label: string; shortLabel: string }> = {
  fast_track_security: { label: 'Fast Track Security', shortLabel: 'Fast Track' },
  priority_checkin:    { label: 'Priority Check-in',   shortLabel: 'Priority CI' },
  priority_boarding:   { label: 'Priority Boarding',   shortLabel: 'Boarding'   },
  priority_baggage:    { label: 'Priority Baggage',    shortLabel: 'Baggage'    },
};

const ORDER: ServiceType[] = [
  'fast_track_security',
  'priority_checkin',
  'priority_boarding',
  'priority_baggage',
];

interface ChipProps {
  service: ServiceType;
  result:  AccessResult;
}

function ServiceChip({ service, result }: ChipProps) {
  const meta   = SERVICE_META[service];
  const status = result.status as AccessStatus;

  if (status === 'not_applicable') return null;

  const isGood  = status === 'allowed' || status === 'likely_allowed';
  const isNone  = status === 'not_offered_at_airport';
  const isDenied = status === 'denied';

  let chipCls: string;
  let iconEl: React.ReactNode;

  if (isGood) {
    chipCls = 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300';
    iconEl  = (
      <svg className="w-3 h-3 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  } else if (isNone) {
    chipCls = 'bg-slate-800/40 border-slate-700/30 text-slate-600';
    iconEl  = <span className="text-slate-600 text-xs">—</span>;
  } else if (isDenied) {
    chipCls = 'bg-slate-800/60 border-slate-700/60 text-slate-500';
    iconEl  = (
      <svg className="w-3 h-3 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  } else {
    // paid_available, not_enough_info, closed, physically_unreachable
    chipCls = 'bg-slate-800/50 border-slate-700/50 text-slate-400';
    iconEl  = <span className="text-slate-500 text-xs">?</span>;
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${chipCls}`}
      title={result.reason}
    >
      {iconEl}
      <span>{meta.shortLabel}</span>
      {status === 'likely_allowed' && (
        <span className="text-[10px] opacity-70">~</span>
      )}
    </div>
  );
}

interface Props {
  services: Record<ServiceType, AccessResult>;
}

export default function AirportServicesPanel({ services }: Props) {
  const chips = ORDER.map((svc) => (
    <ServiceChip key={svc} service={svc} result={services[svc]} />
  ));

  // If every service is not_applicable, render nothing
  const allNA = ORDER.every((s) => services[s].status === 'not_applicable');
  if (allNA) return null;

  // Determine header color from fast_track_security
  const ftStatus = services.fast_track_security.status;
  const hasFastTrack = ftStatus === 'allowed' || ftStatus === 'likely_allowed';

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-3 ${
        hasFastTrack
          ? 'bg-emerald-950/60 border-emerald-700/50'
          : 'bg-slate-800/60 border-slate-700/60'
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
        Airport Services
      </span>
      <div className="flex flex-wrap gap-2">
        {chips}
      </div>
      {/* Reason for fast track, shown beneath chips */}
      {hasFastTrack && services.fast_track_security.accessVia && (
        <p className="text-emerald-400/70 text-xs">
          {services.fast_track_security.accessVia}
        </p>
      )}
    </div>
  );
}
