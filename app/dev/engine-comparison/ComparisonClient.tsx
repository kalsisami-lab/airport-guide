'use client';

import { useState, useEffect } from 'react';

// ─── Types (duplicated from runner for client use) ─────────────────────────────

type ComparisonCategory = 'agree' | 'upgrade' | 'downgrade' | 'refined' | 'only_in_old' | 'only_in_new';
type ReviewBucket = 'old_was_wrong' | 'missing_rule_data' | 'expected_change';

interface LoungeComparison {
  loungeKey:  string;
  oldVerdict: string;
  newVerdict: string;
  category:   ComparisonCategory;
}

interface CaseResult {
  id:          string;
  description: string;
  airport:     string;
  lounges:     LoungeComparison[];
  summary:     Record<ComparisonCategory, number>;
}

interface Report {
  generatedAt: string;
  totalCases:  number;
  totals:      Record<ComparisonCategory, number>;
  cases:       CaseResult[];
}

interface ReviewEntry {
  bucket:  ReviewBucket;
  comment: string;
}

// ─── Helper hooks ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'engine-comparison-reviews';

function useReviews() {
  const [reviews, setReviews] = useState<Record<string, ReviewEntry>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
    catch { return {}; }
  });

  function save(key: string, entry: ReviewEntry) {
    setReviews((prev) => {
      const next = { ...prev, [key]: entry };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clear(key: string) {
    setReviews((prev) => {
      const next = { ...prev };
      delete next[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { reviews, save, clear };
}

// ─── Category colours ──────────────────────────────────────────────────────────

const CAT_STYLE: Record<ComparisonCategory, string> = {
  agree:       'bg-green-100 text-green-800',
  upgrade:     'bg-blue-100 text-blue-800',
  downgrade:   'bg-red-100 text-red-800',
  refined:     'bg-yellow-100 text-yellow-800',
  only_in_old: 'bg-gray-100 text-gray-600',
  only_in_new: 'bg-purple-100 text-purple-800',
};

const CAT_LABEL: Record<ComparisonCategory, string> = {
  agree:       '✅ Agree',
  upgrade:     '⬆ Upgrade',
  downgrade:   '⬇ Downgrade',
  refined:     '🔍 Refined',
  only_in_old: '👴 Only old',
  only_in_new: '🆕 Only new',
};

// ─── Divergence row ────────────────────────────────────────────────────────────

function DivergenceRow({
  caseId, lounge, reviews, onSave, onClear,
}: {
  caseId:   string;
  lounge:   LoungeComparison;
  reviews:  Record<string, ReviewEntry>;
  onSave:   (key: string, entry: ReviewEntry) => void;
  onClear:  (key: string) => void;
}) {
  const key     = `${caseId}:${lounge.loungeKey}`;
  const current = reviews[key];
  const [comment, setComment] = useState(current?.comment ?? '');

  const buckets: { id: ReviewBucket; label: string }[] = [
    { id: 'old_was_wrong',    label: 'Old was wrong' },
    { id: 'missing_rule_data',label: 'Missing rule data' },
    { id: 'expected_change',  label: 'Expected change — UI must explain' },
  ];

  return (
    <tr className={current ? 'bg-slate-50' : undefined}>
      <td className="py-2 px-3 font-mono text-sm">{lounge.loungeKey}</td>
      <td className="py-2 px-3 text-sm text-gray-600">{lounge.oldVerdict}</td>
      <td className="py-2 px-3 text-sm text-gray-600">{lounge.newVerdict}</td>
      <td className="py-2 px-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_STYLE[lounge.category]}`}>
          {CAT_LABEL[lounge.category]}
        </span>
      </td>
      <td className="py-2 px-3">
        <div className="flex flex-wrap gap-1">
          {buckets.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                if (current?.bucket === id) { onClear(key); setComment(''); }
                else onSave(key, { bucket: id, comment });
              }}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                current?.bucket === id
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Comment…"
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            if (current) onSave(key, { ...current, comment: e.target.value });
          }}
          className="mt-1 w-full text-xs border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </td>
    </tr>
  );
}

// ─── Case section ──────────────────────────────────────────────────────────────

function CaseSection({
  c, reviews, onSave, onClear, filter,
}: {
  c: CaseResult;
  reviews: Record<string, ReviewEntry>;
  onSave: (key: string, entry: ReviewEntry) => void;
  onClear: (key: string) => void;
  filter: ComparisonCategory | 'all';
}) {
  const divergent = c.lounges.filter((l) =>
    l.category !== 'agree' &&
    (filter === 'all' || l.category === filter),
  );

  if (divergent.length === 0) return null;

  return (
    <div className="mb-6 border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 flex items-center gap-3 border-b border-slate-200">
        <span className="font-mono text-xs text-slate-500">{c.id}</span>
        <span className="text-sm font-medium">{c.description}</span>
        <span className="ml-auto text-xs text-slate-500">✈ {c.airport}</span>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-100">
            <th className="py-1.5 px-3 font-medium">Lounge</th>
            <th className="py-1.5 px-3 font-medium">Old</th>
            <th className="py-1.5 px-3 font-medium">New</th>
            <th className="py-1.5 px-3 font-medium">Category</th>
            <th className="py-1.5 px-3 font-medium">Review</th>
          </tr>
        </thead>
        <tbody>
          {divergent.map((l) => (
            <DivergenceRow
              key={l.loungeKey}
              caseId={c.id}
              lounge={l}
              reviews={reviews}
              onSave={onSave}
              onClear={onClear}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ComparisonClient({ report }: { report: Report }) {
  const { reviews, save, clear } = useReviews();
  const [filter, setFilter] = useState<ComparisonCategory | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');

  const { totals } = report;
  const reviewed = Object.keys(reviews).length;

  const filteredCases = report.cases.filter((c) => {
    if (reviewFilter === 'reviewed') {
      return c.lounges.some((l) => reviews[`${c.id}:${l.loungeKey}`]);
    }
    if (reviewFilter === 'unreviewed') {
      return c.lounges.some((l) =>
        l.category !== 'agree' && !reviews[`${c.id}:${l.loungeKey}`],
      );
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Engine Comparison</h1>
        <p className="text-sm text-slate-500 mt-1">
          Generated {new Date(report.generatedAt).toLocaleString()} · {report.totalCases} cases · {reviewed} items reviewed
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-6 md:grid-cols-6">
        {(Object.entries(totals) as [ComparisonCategory, number][]).map(([cat, n]) => (
          <button
            key={cat}
            onClick={() => setFilter(filter === cat ? 'all' : cat)}
            className={`rounded-lg p-3 text-center border-2 transition-all ${
              filter === cat ? 'border-slate-700 shadow' : 'border-transparent'
            } ${CAT_STYLE[cat]}`}
          >
            <div className="text-2xl font-bold">{n}</div>
            <div className="text-xs mt-0.5">{CAT_LABEL[cat]}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {(['all', 'unreviewed', 'reviewed'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setReviewFilter(v)}
              className={`text-sm px-3 py-1 rounded border transition-colors ${
                reviewFilter === v
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
              }`}
            >
              {v === 'all' ? 'All' : v === 'reviewed' ? 'Reviewed' : 'Unreviewed'}
            </button>
          ))}
        </div>
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            Clear category filter
          </button>
        )}
      </div>

      {/* Cases */}
      {filteredCases.map((c) => (
        <CaseSection
          key={c.id}
          c={c}
          reviews={reviews}
          onSave={save}
          onClear={clear}
          filter={filter}
        />
      ))}

      {filteredCases.every((c) =>
        c.lounges.every((l) =>
          l.category === 'agree' || (filter !== 'all' && l.category !== filter),
        ),
      ) && (
        <p className="text-center text-slate-400 py-12">
          No divergences to show for the current filter.
        </p>
      )}

      {/* Export reviewed */}
      {reviewed > 0 && (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(reviews, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'engine-comparison-reviews.json';
              a.click();
            }}
            className="text-sm px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600"
          >
            Export {reviewed} reviews as JSON
          </button>
        </div>
      )}
    </div>
  );
}
