'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

type Props = {
  next: string;
};

/**
 * Fires the GitHub OAuth flow as soon as the component mounts so the
 * `/login` route never shows a manual "Sign in" button — clicking
 * "Sign in" anywhere in the app moves directly to GitHub and back to
 * the dashboard. If OAuth fails (network, popup blocker, JS off) we
 * surface the error and a retry button instead of stranding the user.
 */
export default function AutoSignIn({ next }: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const callback = new URL('/auth/callback', window.location.origin);
        callback.searchParams.set('next', next);

        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo: callback.toString() },
        });
        if (oauthError && !cancelled) {
          setError(oauthError.message);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next]);

  function retry(): void {
    setError(null);
    window.location.reload();
  }

  return (
    <div className="text-center">
      {error ? (
        <>
          <div className="text-red-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
            Couldn&apos;t reach GitHub
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-green-500 hover:bg-green-400 text-zinc-950 font-medium text-sm transition"
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 text-zinc-400 text-sm">
            <span
              aria-hidden
              className="size-3 rounded-full border-2 border-green-500 border-t-transparent animate-spin"
            />
            Redirecting to GitHub…
          </div>
        </>
      )}
    </div>
  );
}
