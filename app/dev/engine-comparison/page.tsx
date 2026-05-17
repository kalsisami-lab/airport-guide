import { notFound } from 'next/navigation';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import ComparisonClient from './ComparisonClient';

// Dev-only page — never exposed in production builds.
export const dynamic = 'force-dynamic';

export default function EngineComparisonPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const reportPath = join(process.cwd(), 'tmp', 'engine-comparison-report.json');

  if (!existsSync(reportPath)) {
    return (
      <div className="max-w-2xl mx-auto p-12 font-sans text-center">
        <h1 className="text-xl font-bold text-slate-800 mb-3">No report found</h1>
        <p className="text-slate-500 mb-4">
          Run the comparison script first, then reload this page.
        </p>
        <pre className="bg-slate-100 text-slate-700 rounded px-4 py-3 text-sm inline-block">
          npm run compare-engines
        </pre>
      </div>
    );
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));

  return <ComparisonClient report={report} />;
}
