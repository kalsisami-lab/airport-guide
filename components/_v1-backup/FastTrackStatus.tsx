type Props = {
  hasFastTrack: boolean;
  reasons: string[];
  isGlobal?: boolean;
};

export default function FastTrackStatus({ hasFastTrack, reasons, isGlobal }: Props) {
  const isUsual = isGlobal && hasFastTrack;

  return (
    <div
      className={`rounded-2xl border p-5 flex items-start gap-4 ${
        hasFastTrack
          ? isUsual
            ? 'bg-emerald-950/40 border-emerald-700/30'
            : 'bg-emerald-950/60 border-emerald-700/50'
          : 'bg-slate-800/60 border-slate-700/60'
      }`}
    >
      <div
        className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
          hasFastTrack ? 'bg-emerald-500/20' : 'bg-slate-700/60'
        }`}
      >
        {hasFastTrack ? (
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Fast Track Security
          </span>
          {isUsual && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Global
            </span>
          )}
        </div>
        <p className={`font-semibold text-base ${hasFastTrack ? 'text-emerald-300' : 'text-slate-400'}`}>
          {hasFastTrack ? (isUsual ? 'Usually Available' : 'Eligible') : 'Not Available'}
        </p>
        {hasFastTrack && reasons.length > 0 && (
          <p className="text-emerald-400/70 text-xs mt-1">
            {reasons[0]}
            {isUsual && ' · verify availability at reception'}
          </p>
        )}
        {!hasFastTrack && (
          <p className="text-slate-500 text-xs mt-1">
            {isGlobal
              ? 'Fast Track may still be available — check with your airline or at the security entrance'
              : 'Fast Track requires Finnair Plus Gold+, Oneworld Sapphire+, or Star Alliance Gold'}
          </p>
        )}
      </div>
    </div>
  );
}
