'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

/**
 * Playground client component. The left column takes a git diff, the
 * right column shows the shipping brief returned by
 * POST /api/playground/review. After a successful review an upsell banner
 * points logged-in users to the IDE setup flow and everyone else to login.
 */

type ReviewResponse = {
  text: string;
  structuredContent: unknown;
};

type Status = 'idle' | 'loading' | 'done' | 'error';

export function Playground({ isLoggedIn }: { isLoggedIn: boolean }): React.ReactElement {
  const [diff, setDiff] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(): Promise<void> {
    if (!diff.trim() || status === 'loading') return;
    setStatus('loading');
    setError(null);
    setOutput(null);

    try {
      const res = await fetch('/api/playground/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diff }),
      });
      const data = (await res.json()) as Partial<ReviewResponse> & { error?: string };

      if (!res.ok || typeof data.text !== 'string') {
        setError(data.error ?? 'Something went wrong. Try again.');
        setStatus('error');
        return;
      }

      setOutput(data.text);
      setStatus('done');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <label htmlFor="playground-diff" className="block text-sm font-medium text-zinc-200">
          Paste your diff here
        </label>
        <textarea
          id="playground-diff"
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
          rows={20}
          spellCheck={false}
          placeholder={'diff --git a/app.js b/app.js\n@@ -1,3 +1,4 @@\n...'}
          className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs sm:text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 resize-y"
        />
        <button
          type="button"
          onClick={review}
          disabled={status === 'loading' || !diff.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-green-500 hover:bg-green-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Reviewing…
            </>
          ) : (
            'Review with Senix'
          )}
        </button>
      </div>

      <div>
        <span className="block text-sm font-medium text-zinc-200">Shipping brief</span>
        <div className="mt-2">
          <OutputPanel status={status} output={output} error={error} />
        </div>
        {status === 'done' && <UpsellBanner isLoggedIn={isLoggedIn} />}
      </div>
    </div>
  );
}

function OutputPanel({
  status,
  output,
  error,
}: {
  status: Status;
  output: string | null;
  error: string | null;
}): React.ReactElement {
  const shell =
    'rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 min-h-[20rem]';

  if (status === 'loading') {
    return (
      <div className={`${shell} flex flex-col items-center justify-center text-center`}>
        <Loader2 size={22} className="animate-spin text-green-500" />
        <p className="mt-3 text-sm text-zinc-400">
          Reviewing your changes, this takes about 20 seconds.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={shell}>
        <div className="rounded-md border border-red-900/40 bg-red-950/40 px-3 py-2.5 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (status === 'done' && output) {
    return (
      <pre className={`${shell} whitespace-pre-wrap font-mono text-xs sm:text-sm text-zinc-200 overflow-x-auto`}>
        {output}
      </pre>
    );
  }

  return (
    <div className={`${shell} flex items-center justify-center text-center`}>
      <p className="text-sm text-zinc-500">
        Your shipping brief will appear here after you run a review.
      </p>
    </div>
  );
}

function UpsellBanner({ isLoggedIn }: { isLoggedIn: boolean }): React.ReactElement {
  return (
    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
      <div className="flex items-start gap-2.5">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-green-400" />
        <p className="text-sm text-zinc-200">
          Like what you see? Connect Senix to your IDE for unlimited reviews.
        </p>
      </div>
      <Link
        href={isLoggedIn ? '/dashboard/connect' : '/login'}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-green-500 hover:bg-green-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors"
      >
        Connect your IDE
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
