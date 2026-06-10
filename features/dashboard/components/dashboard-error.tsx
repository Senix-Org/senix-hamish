'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Shared error UI for dashboard route segments. Next.js renders the nearest
 * `error.tsx` when a Server Component throws; `reset()` re-runs that segment
 * (re-fetching its data) without a full-page reload. Each route passes a
 * short noun (e.g. "your reviews") so the message reads naturally.
 */
export function DashboardError({
  subject,
  error,
  reset,
}: {
  subject: string;
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error('[dashboard] segment error', error);
  }, [error]);

  return (
    <div className="mt-8 flex flex-col items-center rounded-xl border border-risk-high/30 bg-risk-high/5 py-16 text-center">
      <AlertTriangle size={32} strokeWidth={1.5} className="text-risk-high" />
      <p className="mt-4 text-sm font-medium text-primary">Something went wrong loading {subject}</p>
      <p className="mt-1 max-w-sm text-sm text-secondary">
        This is usually temporary. Try again, and if it keeps happening, refresh the page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="btn-senix btn-senix-secondary mt-5"
      >
        <RotateCw size={15} />
        Try again
      </button>
    </div>
  );
}
