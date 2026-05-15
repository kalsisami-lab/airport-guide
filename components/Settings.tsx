'use client';

import { useState, useEffect } from 'react';

export const LS_FLIGHT_API_KEY = 'airport-guide:flightApiKey';

interface Props {
  onKeyChange: (key: string | null) => void;
}

export default function Settings({ onKeyChange }: Props) {
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LS_FLIGHT_API_KEY);
    setSaved(stored);
    if (stored) setDraft(stored);
  }, []);

  function save() {
    const trimmed = draft.trim();
    if (trimmed) {
      localStorage.setItem(LS_FLIGHT_API_KEY, trimmed);
      setSaved(trimmed);
      onKeyChange(trimmed);
    }
    setOpen(false);
  }

  function clear() {
    localStorage.removeItem(LS_FLIGHT_API_KEY);
    setSaved(null);
    setDraft('');
    onKeyChange(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Settings"
        className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {saved && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl mx-0 sm:mx-4">
            {/* Handle bar (mobile) */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5 sm:hidden" />

            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-semibold text-base leading-tight">Settings</h2>
                <p className="text-slate-500 text-xs">API access &amp; preferences</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto text-slate-500 hover:text-slate-300 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  Flight API Key
                </label>
                <input
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                  placeholder="Paste your Aviationstack key…"
                  className="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors font-mono tracking-wider"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Get a free key at{' '}
                  <span className="text-blue-400">aviationstack.com</span>
                  {' '}— enables real-time flight data worldwide. Key is stored locally on your device only.
                </p>
              </div>

              {saved && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0" />
                  <p className="text-emerald-300 text-xs font-medium">Real-time flight data active</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={save}
                  disabled={!draft.trim()}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-500 active:bg-blue-700 transition-colors"
                >
                  Save Key
                </button>
                {saved && (
                  <button
                    onClick={clear}
                    className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-sm hover:text-red-400 hover:border-red-400/30 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
