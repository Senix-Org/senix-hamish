'use client';

import { useEffect, useState } from 'react';
import { WhopCheckoutEmbed } from '@whop/checkout/react';
import { Loader2, X } from 'lucide-react';

type PaidPlan = 'starter' | 'team' | 'pro';
type BillingPeriod = 'monthly' | 'yearly';
type CreditPackName = 'small' | 'large';

type PlanProps = {
  kind: 'plan';
  plan: PaidPlan;
  period?: BillingPeriod;
};

type CreditsProps = {
  kind: 'credits';
  pack: CreditPackName;
};

type BaseProps = {
  /** Where to send the user when they are not signed in. */
  loginRedirect: string;
  onClose: () => void;
};

type Props = BaseProps & (PlanProps | CreditsProps);

type CheckoutResponse = { sessionId?: string; affiliateCode?: string; error?: string };

/**
 * Embedded Whop checkout in a modal. On open it asks our server to create a
 * checkout configuration tied to the signed-in user (see /api/checkout), then
 * renders the Whop embed against the returned sessionId. The metadata that
 * links the eventual payment to our user lives on that server-created session,
 * never in anything the browser supplies. For affiliate links the referral
 * cookie is read server-side and, if valid, returned as an `affiliateCode` so
 * Whop can attribute the sale natively.
 */
export function WhopCheckoutDialog(props: Props): React.ReactElement {
  const { loginRedirect, onClose } = props;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestKey =
    props.kind === 'plan'
      ? `plan:${props.plan}:${props.period ?? 'monthly'}`
      : `credits:${props.pack}`;

  useEffect(() => {
    let cancelled = false;

    async function createSession(): Promise<void> {
      const requestBody =
        props.kind === 'plan'
          ? { kind: 'plan', plan: props.plan, period: props.period ?? 'monthly' }
          : { kind: 'credits', pack: props.pack };

      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (response.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent(loginRedirect)}`);
          return;
        }

        const payload = (await response.json()) as CheckoutResponse;
        if (!response.ok || !payload.sessionId) {
          throw new Error(payload.error ?? 'Checkout could not be started.');
        }
        if (!cancelled) {
          setSessionId(payload.sessionId);
          if (payload.affiliateCode) setAffiliateCode(payload.affiliateCode);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    createSession();
    return () => {
      cancelled = true;
    };
  }, [requestKey, loginRedirect]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close checkout"
          className="absolute right-3 top-3 z-10 rounded p-1 text-zinc-400 transition hover:text-zinc-100"
        >
          <X size={18} />
        </button>

        <div className="max-h-[80vh] overflow-y-auto p-1">
          {error ? (
            <div className="p-8 text-center text-sm text-red-300">{error}</div>
          ) : sessionId ? (
            <WhopCheckoutEmbed
              sessionId={sessionId}
              theme="dark"
              fallback={<CheckoutLoading />}
              affiliateCode={affiliateCode ?? undefined}
              onComplete={() => window.location.assign('/checkout/complete')}
            />
          ) : (
            <CheckoutLoading />
          )}
        </div>
      </div>
    </div>
  );
}

function CheckoutLoading(): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-zinc-400">
      <Loader2 size={16} className="animate-spin" />
      Loading secure checkout...
    </div>
  );
}
