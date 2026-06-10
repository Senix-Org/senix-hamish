'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import SignInButton from './sign-in-button';
import { createBrowserSupabaseClient } from '@features/shared/supabase-browser';

/**
 * Auth-aware marketing CTAs. These are client components so the rest of the
 * landing page (and other public pages) can stay server-rendered for SEO:
 * the session is resolved in the browser after mount.
 *
 * Until the session is known we render the logged-out CTAs — that is the
 * correct view for crawlers and the common case, and it avoids a layout
 * flash for signed-out visitors. Signed-in users see their buttons swap to
 * a single "Go to dashboard" once the check resolves.
 */
function useLoggedIn(): boolean | null {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setLoggedIn(Boolean(data.user));
      })
      .catch(() => {
        if (active) setLoggedIn(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return loggedIn;
}

function DashboardLink({ className }: { className: string }): React.ReactElement {
  return (
    <Link href="/dashboard" className={`group ${className}`}>
      <span>Go to dashboard</span>
      <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Desktop nav cluster: "Go to dashboard" when signed in, else Sign in + Get started. */
export function DesktopAuthCta(): React.ReactElement {
  const loggedIn = useLoggedIn();
  if (loggedIn) {
    return (
      <DashboardLink className="btn-senix btn-senix-primary inline-flex items-center justify-center gap-1.5 px-3.5 !h-auto py-1.5 text-sm" />
    );
  }
  return (
    <>
      <SignInButton label="Sign in" variant="text" />
      <SignInButton label="Get started" variant="primary" />
    </>
  );
}

/** Mobile menu cluster. */
export function MobileAuthCta(): React.ReactElement {
  const loggedIn = useLoggedIn();
  if (loggedIn) {
    return (
      <DashboardLink className="btn-senix btn-senix-primary inline-flex w-full items-center justify-center gap-1.5 !h-auto py-3" />
    );
  }
  return (
    <>
      <SignInButton label="Get started" variant="mobile-primary" />
      <SignInButton label="Sign in" variant="mobile-secondary" />
    </>
  );
}

/** Hero CTA: "Go to dashboard" when signed in, else "Get started free". */
export function HeroAuthCta(): React.ReactElement {
  const loggedIn = useLoggedIn();
  if (loggedIn) {
    return (
      <DashboardLink className="btn-senix btn-senix-primary inline-flex items-center justify-center gap-1.5 px-5 !h-auto py-3 text-sm" />
    );
  }
  return <SignInButton label="Get started free" variant="hero" />;
}
