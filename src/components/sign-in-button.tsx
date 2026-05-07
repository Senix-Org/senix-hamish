'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

function GithubMark(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.31-5.47-1.34-5.47-5.95 0-1.32.47-2.39 1.24-3.23-.13-.31-.54-1.55.12-3.23 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.68.25 2.92.12 3.23.77.84 1.24 1.91 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z" />
    </svg>
  );
}

type Props = {
  /** Optional override for the post-callback redirect path. */
  next?: string;
  /** Optional CTA override. Defaults to "Sign in with GitHub". */
  label?: string;
};

/**
 * Kicks off the Supabase OAuth flow with GitHub. After the user
 * authorises on GitHub, Supabase bounces them back to /auth/callback,
 * which exchanges the code for a session and lands them on /dashboard
 * (or `next`).
 */
export default function SignInButton({ next, label }: Props): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const callback = new URL('/auth/callback', window.location.origin);
      if (next) callback.searchParams.set('next', next);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: callback.toString() },
      });
      if (oauthError) {
        throw oauthError;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 w-full">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-green-500 hover:bg-green-400 disabled:opacity-50 text-zinc-950 font-medium text-sm transition"
      >
        <GithubMark />
        {busy ? 'Redirecting…' : (label ?? 'Sign in with GitHub')}
      </button>
      {error && <div className="text-red-400 text-xs">{error}</div>}
    </div>
  );
}
