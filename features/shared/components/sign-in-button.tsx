'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createBrowserSupabaseClient } from '@features/shared/supabase-browser';

type SignInVariant =
  | 'primary'
  | 'secondary'
  | 'text'
  | 'hero'
  | 'trae'
  | 'mobile-primary'
  | 'mobile-secondary';

type Props = {
  /** Optional override for the post-callback redirect path. */
  next?: string;
  /** Optional CTA override. Defaults to "Sign in with GitHub". */
  label?: string;
  /** Visual treatment for the button. */
  variant?: SignInVariant;
  /** Show the GitHub mark before the label. */
  showGithub?: boolean;
  /** Show an arrow after the label. */
  showArrow?: boolean;
  /** Extra classes for the button element. */
  className?: string;
};

function GithubMark({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.31-5.47-1.34-5.47-5.95 0-1.32.47-2.39 1.24-3.23-.13-.31-.54-1.55.12-3.23 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.68.25 2.92.12 3.23.77.84 1.24 1.91 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z" />
    </svg>
  );
}

/**
 * Starts Supabase GitHub OAuth directly from the CTA that was clicked.
 * Supabase redirects back to /auth/callback, which exchanges the code
 * and then sends the user to `next`.
 */
export default function SignInButton({
  next = '/dashboard',
  label,
  variant = 'primary',
  showGithub = false,
  showArrow = false,
  className = '',
}: Props): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authHref = `/api/auth/github?next=${encodeURIComponent(next)}`;

  async function onClick(event: React.MouseEvent<HTMLAnchorElement>): Promise<void> {
    if (busy) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setBusy(true);
    setError(null);

    const fallbackTimer = window.setTimeout(() => {
      window.location.assign(authHref);
    }, 1500);

    try {
      const supabase = createBrowserSupabaseClient();
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', next);

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
      });

      if (oauthError) {
        throw oauthError;
      }

      if (!data.url) {
        throw new Error('GitHub OAuth did not return a redirect URL.');
      }

      window.clearTimeout(fallbackTimer);
      window.location.assign(data.url);
    } catch (e) {
      window.clearTimeout(fallbackTimer);
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className={containerClass(variant)}>
      <a
        href={authHref}
        onClick={onClick}
        aria-disabled={busy}
        className={`${buttonClass(variant)} ${className}`}
      >
        {showGithub && <GithubMark className="shrink-0" />}
        <span>{busy ? 'Redirecting...' : (label ?? 'Sign in with GitHub')}</span>
        {showArrow && (
          <ArrowRight
            size={16}
            className="shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        )}
      </a>
      {error && <div className={errorClass(variant)}>{error}</div>}
    </div>
  );
}

function containerClass(variant: SignInVariant): string {
  if (variant === 'text') {
    return 'relative inline-flex flex-col items-start';
  }
  if (variant === 'hero') {
    return 'inline-flex flex-col items-center gap-2';
  }
  if (variant === 'trae') {
    return 'inline-flex flex-col items-center gap-2';
  }
  return 'flex flex-col items-stretch gap-2';
}

function buttonClass(variant: SignInVariant): string {
  const base =
    'group inline-flex items-center justify-center gap-1.5 aria-disabled:opacity-50 aria-disabled:cursor-wait transition';

  switch (variant) {
    case 'text':
      return `${base} text-sm text-secondary hover:text-primary`;
    case 'hero':
      return `${base} btn-senix btn-senix-primary px-5 !h-auto py-3 text-sm`;
    case 'trae':
      return `${base} trae-btn trae-btn-brand inline-flex h-10 min-w-[96px] items-center justify-center rounded-md bg-[var(--trae-brand)] px-6 text-sm font-medium tracking-wide text-[#0a0b0d] hover:bg-[var(--trae-brand-hover)] xl:h-16 xl:px-7 xl:text-base`;
    case 'secondary':
      return `${base} btn-senix btn-senix-secondary px-4 !h-auto py-2.5 text-sm`;
    case 'mobile-primary':
      return `${base} btn-senix btn-senix-primary w-full !h-auto py-3`;
    case 'mobile-secondary':
      return `${base} btn-senix btn-senix-secondary w-full !h-auto py-3`;
    case 'primary':
    default:
      return `${base} btn-senix btn-senix-primary px-3.5 !h-auto py-1.5 text-sm`;
  }
}

function errorClass(variant: SignInVariant): string {
  if (variant === 'text') {
    return 'absolute top-full mt-2 w-56 rounded-md border border-red-900/40 bg-red-950/80 px-2 py-1 text-xs text-red-200 shadow-lg shadow-black/20';
  }
  if (variant === 'hero') {
    return 'max-w-xs text-center text-red-400 text-xs';
  }
  return 'text-red-400 text-xs';
}
