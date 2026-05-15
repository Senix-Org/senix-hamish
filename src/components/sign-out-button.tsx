'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

/**
 * Signs the user out of Supabase and routes back to the public
 * landing page. Kept intentionally tiny — no confirmation popup.
 */
export default function SignOutButton(): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(): Promise<void> {
    setBusy(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 p-2 rounded text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-900 disabled:opacity-50 transition-colors"
      aria-label="Sign out"
    >
      <LogOut size={14} />
      <span>{busy ? 'Signing out…' : 'Sign out'}</span>
    </button>
  );
}
