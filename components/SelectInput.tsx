'use client';

import { useState, useRef, useEffect } from 'react';

type Option<T> = {
  value: T;
  label: string;
  sublabel?: string;
};

type Props<T extends string> = {
  label: string;
  placeholder: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  icon?: string;
  // Async search — when provided, typing triggers onSearch instead of local filtering
  onSearch?: (query: string) => void;
  asyncOptions?: Option<T>[];
  isSearching?: boolean;
};

export default function SelectInput<T extends string>({
  label,
  placeholder,
  options,
  value,
  onChange,
  icon,
  onSearch,
  asyncOptions,
  isSearching,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Find selected label from static options first, then async results
  const selected =
    options.find((o) => o.value === value) ??
    asyncOptions?.find((o) => o.value === value) ??
    null;

  // Whether we're in async-search mode (query is long enough)
  const asyncMode = !!onSearch && query.length >= 2;

  const filtered = asyncMode
    ? []
    : query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  // Propagate query changes to the async search callback
  useEffect(() => {
    onSearch?.(query);
  }, [query, onSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (val: T | null) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} className="relative w-full">
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-left text-sm transition-colors hover:border-blue-500 focus:outline-none focus:border-blue-500"
      >
        <span className={selected ? 'text-white' : 'text-slate-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={onSearch ? 'Search worldwide…' : 'Search...'}
              className="w-full px-3 py-2 bg-slate-900 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
            />
          </div>

          <ul className="max-h-64 overflow-y-auto">
            {value && (
              <li>
                <button
                  onClick={() => handleSelect(null)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-400 hover:bg-slate-700"
                >
                  Clear selection
                </button>
              </li>
            )}

            {/* Async search results */}
            {asyncMode && (
              <>
                {isSearching ? (
                  <li className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Searching worldwide…
                  </li>
                ) : (asyncOptions ?? []).length === 0 ? (
                  <li className="px-4 py-3 text-sm text-slate-500">No airports found</li>
                ) : (
                  <>
                    <li className="px-4 pt-2 pb-1">
                      <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                        🌐 Global results
                      </span>
                    </li>
                    {(asyncOptions ?? []).map((opt) => (
                      <li key={opt.value}>
                        <button
                          onClick={() => handleSelect(opt.value)}
                          className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-slate-700 ${
                            value === opt.value ? 'text-blue-400' : 'text-white'
                          }`}
                        >
                          <div>{opt.label}</div>
                          {opt.sublabel && (
                            <div className="text-xs text-slate-400 mt-0.5">{opt.sublabel}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </>
                )}
              </>
            )}

            {/* Static / filtered options */}
            {!asyncMode && (
              <>
                {onSearch && !query && (
                  <li className="px-4 pt-2 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      ✈ Suggested airports
                    </span>
                  </li>
                )}
                {filtered.length === 0 && (
                  <li className="px-4 py-3 text-sm text-slate-500">No results</li>
                )}
                {filtered.map((opt) => (
                  <li key={opt.value}>
                    <button
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-slate-700 ${
                        value === opt.value ? 'text-blue-400' : 'text-white'
                      }`}
                    >
                      <div>{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-xs text-slate-400 mt-0.5">{opt.sublabel}</div>
                      )}
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
