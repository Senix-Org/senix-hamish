'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

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
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-medium transition"
      >
        {busy ? 'Redirecting…' : (label ?? 'Sign in with GitHub')}
      </button>
      {error && <div className="text-red-400 text-sm">{error}</div>}
    </div>
  );
}
