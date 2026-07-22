'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import posthog from 'posthog-js';
import { createBrowserSupabaseClient } from '@features/shared/supabase-browser';

/**
 * Signs the user out of Supabase and routes back to the public landing
 * page. Styled as a quiet sidebar link. When the sidebar is collapsed
 * the label is hidden on desktop and only the icon remains.
 */
export default function SignOutButton({
  collapsed = false,
}: {
  collapsed?: boolean;
}): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(): Promise<void> {
    setBusy(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    // Detach the analytics session so the next anonymous visitor on this
    // browser is not attributed to the user who just signed out.
    if (typeof posthog.reset === 'function') posthog.reset();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={collapsed ? 'Sign out' : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-primary disabled:opacity-50 ${
        collapsed ? 'md:justify-center' : ''
      }`}
      aria-label="Sign out"
    >
      <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
      <span className={collapsed ? 'md:hidden' : ''}>
        {busy ? 'Signing out' : 'Sign out'}
      </span>
    </button>
  );
}
