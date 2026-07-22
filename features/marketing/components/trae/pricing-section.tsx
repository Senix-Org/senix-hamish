'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PLAN_LIMITS, type PlanName } from '@features/billing/plan-limits';
import { TraeButton } from '../ui/trae-button';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useTraeReveal } from '../../hooks/use-trae-reveal';

type BillingPeriod = 'monthly' | 'yearly';

/**
 * Same numbers as the billing page compare grid
 * (`src/app/dashboard/billing/billing-client.tsx`).
 */
const PLAN_PRICING: Record<
  PlanName,
  { monthly: number; yearlyMonthly: number; yearlyTotal: number }
> = {
  free: { monthly: 0, yearlyMonthly: 0, yearlyTotal: 0 },
  starter: { monthly: 18, yearlyMonthly: 14, yearlyTotal: 168 },
  team: { monthly: 79, yearlyMonthly: 63, yearlyTotal: 756 },
  pro: { monthly: 199, yearlyMonthly: 159, yearlyTotal: 1908 },
};

type LandingTier = {
  plan: PlanName;
  label: string;
  blurb: string;
  repos: number;
  tokens: number;
  support: string;
  cta: string;
  href: string;
  highlight?: boolean;
};

const TIERS: LandingTier[] = [
  {
    plan: 'free',
    label: PLAN_LIMITS.free.label,
    blurb: 'Try Senix on one repo',
    repos: PLAN_LIMITS.free.repos,
    tokens: PLAN_LIMITS.free.tokens,
    support: 'Community',
    cta: 'Get started free',
    href: '/login',
  },
  {
    plan: 'starter',
    label: PLAN_LIMITS.starter.label,
    blurb: 'For solo developers shipping often',
    repos: PLAN_LIMITS.starter.repos,
    tokens: PLAN_LIMITS.starter.tokens,
    support: 'Community',
    cta: 'Subscribe to Starter',
    href: '/pricing',
  },
  {
    plan: 'team',
    label: PLAN_LIMITS.team.label,
    blurb: 'For small teams with shared repos',
    repos: PLAN_LIMITS.team.repos,
    tokens: PLAN_LIMITS.team.tokens,
    support: 'Email, 48 hour response',
    cta: 'Subscribe to Team',
    href: '/pricing',
    highlight: true,
  },
  {
    plan: 'pro',
    label: PLAN_LIMITS.pro.label,
    blurb: 'For teams with larger review volume',
    repos: PLAN_LIMITS.pro.repos,
    tokens: PLAN_LIMITS.pro.tokens,
    support: 'Priority, 24 hour response',
    cta: 'Subscribe to Pro',
    href: '/pricing',
  },
];

function formatRepos(repos: number): string {
  if (repos < 0) return 'Unlimited repos';
  return repos === 1 ? '1 repo' : `${repos} repos`;
}

/** Landing pricing grid aligned with the billing page plans and prices. */
export function TraePricingSection(): React.ReactElement {
  const ref = useTraeReveal<HTMLElement>({ childSelector: '[data-trae-item]', stagger: 0.08 });
  const gridRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  useEffect(() => {
    if (reduced || !gridRef.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const highlight = gridRef.current?.querySelector('[data-pricing-highlight]');
      if (!highlight) return;

      ctx = gsap.context(() => {
        gsap.to(highlight, {
          boxShadow: '0 0 48px -8px rgba(50, 240, 140, 0.35)',
          duration: 2.4,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });

        const badge = highlight.querySelector('[data-pricing-badge]');
        if (badge) {
          gsap.to(badge, {
            scale: 1.06,
            duration: 1.6,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          });
        }
      }, gridRef);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  const yearly = period === 'yearly';

  return (
    <section id="pricing" ref={ref} className="trae-section py-20 md:py-28">
      <div data-trae-item className="opacity-0">
        <p className="trae-section-label">Pricing</p>
        <h2 className="trae-section-title">Simple plans. No surprises.</h2>
        <p className="trae-section-desc">
          Same plans as billing. Start free, upgrade when your team needs more volume.
        </p>
      </div>

      <div
        data-trae-item
        className="mt-8 inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0f0d14] p-1 opacity-0"
        role="group"
        aria-label="Billing period"
      >
        <PeriodButton active={period === 'monthly'} onClick={() => setPeriod('monthly')}>
          Monthly
        </PeriodButton>
        <PeriodButton active={period === 'yearly'} onClick={() => setPeriod('yearly')}>
          Yearly
          <span className="ml-1.5 rounded-full bg-[#32f08c]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#32f08c]">
            Save ~20%
          </span>
        </PeriodButton>
      </div>

      <div ref={gridRef} className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((tier) => {
          const pricing = PLAN_PRICING[tier.plan];
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
            <article
              key={tier.plan}
              data-trae-item
              data-pricing-highlight={tier.highlight ? true : undefined}
              className={`trae-card relative flex flex-col p-6 opacity-0 ${
                tier.highlight
                  ? 'border-[#32f08c]/40 shadow-[0_0_40px_-12px_rgba(50,240,140,0.25)]'
                  : ''
              }`}
            >
              {tier.highlight ? (
                <span
                  data-pricing-badge
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded border border-[#32f08c]/40 bg-[#32f08c]/10 px-3 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#32f08c]"
                >
                  Most popular
                </span>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-medium text-white">{tier.label}</h3>
                {yearly && paid ? (
                  <span className="rounded-full bg-[#32f08c]/15 px-2 py-0.5 text-[10px] font-medium text-[#32f08c]">
                    Save {savePercent}%
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-[#8b8794]">{tier.blurb}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span
                  className={`text-4xl font-medium tracking-tight ${
                    tier.highlight ? 'trae-gradient-text' : 'text-white'
                  }`}
                >
                  ${displayMonthly}
                </span>
                <span className="text-sm text-[#8b8794]">/mo</span>
              </div>

              <div className="mt-1 min-h-[1.25rem] text-xs text-[#8b8794]">
                {yearly && paid ? (
                  <span>
                    billed annually (${pricing.yearlyTotal.toLocaleString()}/yr) ·{' '}
                    <span className="text-[#c9c5d2] line-through">${pricing.monthly}/mo</span>
                  </span>
                ) : (
                  <span>{paid ? 'billed monthly' : 'forever free'}</span>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#c9c5d2]">
                    <Check size={14} className="mt-0.5 shrink-0 text-[#32f08c]" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              <TraeButton
                href={tier.href}
                variant={tier.highlight ? 'brand' : 'outline'}
                className="mt-8 h-11 w-full xl:h-12"
              >
                {tier.cta}
              </TraeButton>
            </article>
          );
        })}
      </div>

      <p data-trae-item className="mt-8 text-center text-sm text-[#8b8794] opacity-0">
        Need details or checkout?{' '}
        <Link href="/pricing" className="text-[#32f08c] hover:text-[#3ee1a3]">
          See full pricing
        </Link>
      </p>
    </section>
  );
}

function PeriodButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-md px-3.5 py-2 text-sm font-medium transition ${
        active
          ? 'bg-white text-black'
          : 'text-[#c9c5d2] hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
