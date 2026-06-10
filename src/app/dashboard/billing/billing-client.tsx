'use client';

import { useEffect, useState } from 'react';
import { Check, CreditCard, Loader2, Sparkles, X, Zap } from 'lucide-react';

const BILLING_PERIOD_KEY = 'senix-billing-period';

export type BillingPlanName = 'free' | 'starter' | 'team' | 'pro';
export type BillingPlanStatus = 'active' | 'trialing' | 'cancelled' | 'past_due';

export type BillingTier = {
  plan: BillingPlanName;
  label: string;
  price: string;
  repos: number;
  tokens: number;
  support: string;
  trial: string;
};

export type BillingPlanData = {
  plan: BillingPlanName;
  planStatus: BillingPlanStatus;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  whopMembershipId: string | null;
  tokensUsed: number;
  tokenLimit: number;
  reposConnected: number;
  repoLimit: number;
  tokensResetAt: string;
};

type Props = {
  planData: BillingPlanData;
  tiers: BillingTier[];
};

const PLAN_ORDER: BillingPlanName[] = ['free', 'starter', 'team', 'pro'];

type BillingPeriod = 'monthly' | 'yearly';

/**
 * Per-plan pricing. `monthly` is the standard monthly price; `yearlyMonthly`
 * is the discounted per-month price when billed annually (~20% off), and
 * `yearlyTotal` is the upfront annual charge. Free stays at zero.
 */
const PLAN_PRICING: Record<BillingPlanName, {
  monthly: number;
  yearlyMonthly: number;
  yearlyTotal: number;
}> = {
  free: { monthly: 0, yearlyMonthly: 0, yearlyTotal: 0 },
  starter: { monthly: 18, yearlyMonthly: 14, yearlyTotal: 168 },
  team: { monthly: 79, yearlyMonthly: 63, yearlyTotal: 756 },
  pro: { monthly: 199, yearlyMonthly: 159, yearlyTotal: 1908 },
};

/**
 * Billing overview. Three sections, top to bottom: the current plan with a
 * usage bar and quota reset, a row of usage stat cards for the cycle, and a
 * side-by-side plan comparison. Analytics charts deliberately live
 * elsewhere — this page is for understanding the plan and upgrading fast.
 */
export function BillingClient({ planData, tiers }: Props): React.ReactElement {
  const [currentPlanData, setCurrentPlanData] = useState(planData);
  const [checkoutBusy, setCheckoutBusy] = useState<BillingPlanName | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Plan-comparison billing period. Defaults to monthly, then hydrates from
  // localStorage on mount so the choice survives navigation and refreshes.
  // (Read in an effect, not in the initial state, to avoid an SSR/hydration
  // mismatch.)
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BILLING_PERIOD_KEY);
      if (stored === 'monthly' || stored === 'yearly') {
        // Hydrating a persisted UI preference on mount. A lazy useState
        // initializer can't read localStorage without an SSR mismatch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPeriod(stored);
      }
    } catch {
      // localStorage can be unavailable (private mode); fall back to default.
    }
  }, []);

  function changePeriod(next: BillingPeriod): void {
    setPeriod(next);
    try {
      window.localStorage.setItem(BILLING_PERIOD_KEY, next);
    } catch {
      // Ignore persistence failures; the in-memory state still updates.
    }
  }

  const currentTier = tiers.find((tier) => tier.plan === currentPlanData.plan) ?? tiers[0];
  const nextTier = getNextTier(currentPlanData.plan, tiers);
  const paidPlan = currentPlanData.plan !== 'free';

  const tokenProgress = Math.min(
    100,
    (currentPlanData.tokensUsed / Math.max(currentPlanData.tokenLimit, 1)) * 100
  );
  const tokenProgressTone =
    tokenProgress >= 100 ? 'bg-risk-high' : tokenProgress >= 80 ? 'bg-amber-500' : 'bg-accent';

  async function startCheckout(plan: BillingPlanName): Promise<void> {
    setCheckoutBusy(plan);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, period }),
      });

      if (response.status === 401) {
        window.location.assign('/login?next=/dashboard/billing');
        return;
      }

      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? 'Checkout could not be started.');
      }

      window.location.assign(payload.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCheckoutBusy(null);
    }
  }

  async function cancelSubscription(): Promise<void> {
    setCancelBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/billing/cancel', { method: 'DELETE' });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Subscription could not be cancelled.');
      }

      setConfirmCancel(false);
      setCurrentPlanData((value) => ({ ...value, planStatus: 'cancelled' }));
      setMessage('Subscription cancellation is scheduled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div>
      <header>
        <h1 className="text-3xl font-semibold text-primary">Billing</h1>
        <p className="mt-2 text-sm text-secondary">
          Manage your plan and track usage for this billing cycle.
        </p>
      </header>

      {/* Current plan */}
      <section className="mt-8 rounded-xl border border-surface-border bg-surface p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted">Current plan</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-primary">{currentTier.label}</h2>
              <span className={statusBadgeClass(currentPlanData.planStatus)}>
                {statusLabel(currentPlanData.planStatus)}
              </span>
              <span className="text-sm text-secondary">{currentTier.price}/month</span>
            </div>
            {currentPlanData.planStatus === 'trialing' && currentPlanData.trialEndsAt && (
              <p className="mt-2 text-sm text-amber-300">
                Trial ends in {daysUntil(currentPlanData.trialEndsAt)} days
              </p>
            )}
            {currentPlanData.planStatus === 'cancelled' && (
              <p className="mt-2 text-sm text-red-300">
                {currentPlanData.planExpiresAt
                  ? `Plan cancelled. Access until ${formatDate(currentPlanData.planExpiresAt)}.`
                  : 'Plan cancelled. Access has ended.'}
              </p>
            )}
          </div>

          {nextTier && (
            <button
              type="button"
              onClick={() => startCheckout(nextTier.plan)}
              disabled={checkoutBusy !== null}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
            >
              {checkoutBusy === nextTier.plan ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CreditCard size={16} />
              )}
              Upgrade to {nextTier.label}
            </button>
          )}
        </div>

        {/* Usage bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">Tokens used this month</span>
            <span className="tabular-nums text-primary">
              {currentPlanData.tokensUsed.toLocaleString()} /{' '}
              {currentPlanData.tokenLimit.toLocaleString()} tokens
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-raised">
            <div
              className={`h-full rounded-full transition-all ${tokenProgressTone}`}
              style={{ width: `${tokenProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Quota resets {formatDate(nextResetDate(currentPlanData.tokensResetAt))}
          </p>
        </div>

        {paidPlan && (
          <div className="mt-5 border-t border-surface-border pt-4">
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="text-xs text-muted transition-colors hover:text-risk-high"
            >
              Cancel subscription
            </button>
          </div>
        )}
      </section>

      {/* Usage overview */}
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Zap size={16} className="text-accent" />}
          label="Tokens used this month"
          value={currentPlanData.tokensUsed.toLocaleString()}
          sub={`of ${currentPlanData.tokenLimit.toLocaleString()} included`}
        />
        <StatCard
          icon={<Sparkles size={16} className="text-accent" />}
          label="Repos connected"
          value={currentPlanData.reposConnected.toLocaleString()}
          sub={
            currentPlanData.repoLimit === -1
              ? 'Unlimited on your plan'
              : `of ${currentPlanData.repoLimit.toLocaleString()} on your plan`
          }
        />
      </section>

      {/* Plan comparison */}
      <section className="mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-primary">Compare plans</h2>
          <PeriodToggle period={period} onChange={changePeriod} />
        </div>
        <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
          {tiers.map((tier) => (
            <PlanCard
              key={tier.plan}
              tier={tier}
              period={period}
              currentPlan={currentPlanData.plan}
              busy={checkoutBusy === tier.plan}
              disabled={checkoutBusy !== null}
              onUpgrade={() => startCheckout(tier.plan)}
            />
          ))}
        </div>
      </section>

      {(message || error) && (
        <div
          className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
            error
              ? 'border-red-900/40 bg-red-950/30 text-red-200'
              : 'border-green-900/40 bg-green-950/30 text-green-200'
          }`}
        >
          {error ?? message}
        </div>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-primary">Cancel subscription</h2>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                aria-label="Close"
                className="rounded p-1 text-secondary transition-colors hover:text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              Are you sure you want to cancel? You will be downgraded to the Free plan at the end
              of your billing period.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:text-primary"
              >
                Keep subscription
              </button>
              <button
                type="button"
                onClick={cancelSubscription}
                disabled={cancelBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200 transition-colors hover:bg-red-950/70 disabled:cursor-wait disabled:opacity-60"
              >
                {cancelBusy && <Loader2 size={15} className="animate-spin" />}
                Cancel subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums text-primary">{value}</div>
      <div className="mt-1 text-xs text-secondary">{sub}</div>
    </div>
  );
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}): React.ReactElement {
  const options: Array<{ key: BillingPeriod; label: string }> = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ];
  return (
    <div className="inline-flex items-center gap-1 self-start rounded-full border border-surface-border bg-surface p-1 text-sm">
      {options.map((o) => {
        const active = period === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
              active ? 'bg-surface-raised text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            {o.label}
            {o.key === 'yearly' && (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                -20%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({
  tier,
  period,
  currentPlan,
  busy,
  disabled,
  onUpgrade,
}: {
  tier: BillingTier;
  period: BillingPeriod;
  currentPlan: BillingPlanName;
  busy: boolean;
  disabled: boolean;
  onUpgrade: () => void;
}): React.ReactElement {
  const isCurrent = tier.plan === currentPlan;
  const tierIndex = PLAN_ORDER.indexOf(tier.plan);
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const isUpgrade = tierIndex > currentIndex;

  const pricing = PLAN_PRICING[tier.plan];
  const yearly = period === 'yearly';
  const paid = pricing.monthly > 0;
  const displayMonthly = yearly ? pricing.yearlyMonthly : pricing.monthly;
  const savePercent = paid
    ? Math.round((1 - pricing.yearlyMonthly / pricing.monthly) * 100)
    : 0;

  const features = [
    `${tier.tokens.toLocaleString()} tokens / month`,
    formatRepos(tier.repos),
    tier.support,
  ];

  return (
    <div
      className={`flex w-60 shrink-0 snap-start flex-col rounded-xl border bg-surface p-5 sm:w-auto sm:shrink ${
        isCurrent ? 'border-accent ring-1 ring-accent/40' : 'border-surface-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">{tier.label}</span>
        {isCurrent ? (
          <span className="text-xs font-medium text-accent">Current</span>
        ) : (
          yearly &&
          paid && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
              Save {savePercent}%
            </span>
          )
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-primary">${displayMonthly}</span>
        <span className="text-xs text-muted">/mo</span>
      </div>
      <div className="mt-1 min-h-[1.25rem] text-xs text-muted">
        {yearly && paid ? (
          <span>
            billed annually (${pricing.yearlyTotal.toLocaleString()}/yr) ·{' '}
            <span className="text-secondary line-through">${pricing.monthly}/mo</span>
          </span>
        ) : null}
      </div>

      <div className="my-4 border-t border-surface-border" />

      <ul className="flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-secondary">
            <Check size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {isCurrent ? (
          <button
            type="button"
            disabled
            className="w-full cursor-default rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm font-medium text-secondary"
          >
            Current plan
          </button>
        ) : isUpgrade ? (
          <button
            type="button"
            onClick={onUpgrade}
            disabled={disabled}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Upgrade
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-default rounded-lg border border-surface-border px-3 py-2 text-sm font-medium text-muted"
          >
            Lower tier
          </button>
        )}
      </div>
    </div>
  );
}

function nextResetDate(currentResetIso: string): string {
  const base = new Date(currentResetIso);
  if (Number.isNaN(base.getTime())) return currentResetIso;
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  return next.toISOString();
}

function getNextTier(plan: BillingPlanName, tiers: BillingTier[]): BillingTier | null {
  const index = PLAN_ORDER.indexOf(plan);
  const next = PLAN_ORDER[index + 1];
  return next ? tiers.find((tier) => tier.plan === next) ?? null : null;
}

function statusBadgeClass(status: BillingPlanStatus): string {
  const base = 'rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider';

  switch (status) {
    case 'trialing':
      return `${base} border-amber-900/50 bg-amber-950/30 text-amber-200`;
    case 'cancelled':
    case 'past_due':
      return `${base} border-red-900/50 bg-red-950/30 text-red-200`;
    case 'active':
    default:
      return `${base} border-green-900/50 bg-green-950/30 text-green-200`;
  }
}

function statusLabel(status: BillingPlanStatus): string {
  if (status === 'past_due') return 'Past due';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function daysUntil(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatRepos(repos: number): string {
  if (repos === -1) return 'Unlimited repos';
  return `${repos.toLocaleString()} ${repos === 1 ? 'repo' : 'repos'}`;
}
