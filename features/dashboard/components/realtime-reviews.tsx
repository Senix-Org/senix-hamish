'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, X } from 'lucide-react';
import { createBrowserSupabaseClient } from '@features/shared/supabase-browser';

/**
 * Live-updates the dashboard when analyses change.
 *
 * Subscribes to Postgres changes on the `analyses` table over Supabase
 * Realtime. Row-level security scopes the stream to the signed-in user's
 * own analyses, so we don't filter by user here. On any insert or status
 * change we refresh the server component (which re-runs the RLS-scoped
 * query and re-renders the cards), and when a review transitions into the
 * `completed` state we surface a subtle toast.
 *
 * The component renders only the toast; it is dropped onto any page that
 * shows reviews (overview and the reviews list). The subscription is torn
 * down on unmount.
 */
export function RealtimeReviews(): React.ReactElement | null {
  const router = useRouter();
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    // Debounce server re-renders: a burst of Realtime events (e.g. several
    // analyses completing at once) collapses into a single router.refresh()
    // two seconds after the last event, instead of one full re-render per
    // event. The toast still fires immediately on its event.
    function debouncedRefresh(): void {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        router.refresh();
        refreshTimeoutRef.current = null;
      }, 2000);
    }

    const channel = supabase
      .channel('dashboard-analyses')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analyses' },
        () => {
          debouncedRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'analyses' },
        (payload) => {
          const next = payload.new as { status?: string } | null;
          const prev = payload.old as { status?: string } | null;
          debouncedRefresh();
          if (next?.status === 'completed' && prev?.status !== 'completed') {
            showToast();
          }
        }
      )
      .subscribe();

    function showToast(): void {
      setToast(true);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(false), 6000);
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  if (!toast) return null;

  return (
    <div className="animate-fade-up fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-accent/30 bg-surface px-4 py-3 shadow-2xl shadow-black/40">
      <CheckCircle2 size={18} className="shrink-0 text-accent" />
      <span className="text-sm font-medium text-primary">New review available</span>
      <button
        type="button"
        onClick={() => setToast(false)}
        aria-label="Dismiss"
        className="ml-1 rounded p-0.5 text-muted transition-colors hover:text-primary"
      >
        <X size={15} />
      </button>
    </div>
  );
}
