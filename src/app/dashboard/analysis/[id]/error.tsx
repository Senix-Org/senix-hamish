'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Error boundary for the per-analysis detail route. Keeps the dashboard
 * shell intact so users can navigate back to the list without a hard
 * reload.
 */
export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error('[analysis]', error);
  }, [error]);

  return (
    <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-8">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            We couldn&apos;t load this analysis.
          </h2>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            The analysis row may have been deleted, or there was a transient backend issue.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-zinc-600">ref: {error.digest}</p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-md bg-zinc-100 text-zinc-950 text-sm font-medium hover:bg-white transition"
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-md border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-200 transition"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
