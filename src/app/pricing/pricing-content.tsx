'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, GitPullRequest, Plug, Sparkles, Zap } from 'lucide-react';
import { PLAN_LIMITS, type PlanName } from '@features/billing/plan-limits';
import { Reveal, RevealItem, RevealStagger } from '@features/shared/components/reveal';
import { Faq } from './faq';
import { PricingCheckoutButton } from './pricing-checkout-button';

type BillingPeriod = 'monthly' | 'yearly';

type Tier = {
  plan: PlanName;
  name: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

const PLAN_PRICES: Record<
  Exclude<PlanName, 'free'>,
  { monthly: number; yearlyMonthly: number }
> = {
  starter: { monthly: 18, yearlyMonthly: 14 },
  team: { monthly: 79, yearlyMonthly: 63 },
  pro: { monthly: 199, yearlyMonthly: 159 },
};

const TIERS: Tier[] = [
  {
    plan: 'free',
    name: 'Free',
    blurb: 'Try Senix on one repo',
    features: [
      `${PLAN_LIMITS.free.repos} repo`,
      `${PLAN_LIMITS.free.tokens.toLocaleString()} tokens / month`,
      'GitHub PR + MCP included',
      'Community support',
      'Permanent free plan',
    ],
    cta: 'Get started free',
  },
  {
    plan: 'starter',
    name: 'Starter',
    blurb: 'For solo developers shipping often',
    features: [
      `${PLAN_LIMITS.starter.repos} repos`,
      `${PLAN_LIMITS.starter.tokens.toLocaleString()} tokens / month`,
      'GitHub PR + MCP included',
      'Community support',
      'Billed monthly or yearly',
    ],
    cta: 'Subscribe to Starter',
  },
  {
    plan: 'team',
    name: 'Team',
    blurb: 'For small teams with shared repos',
    features: [
      `${PLAN_LIMITS.team.repos} repos`,
      `${PLAN_LIMITS.team.tokens.toLocaleString()} tokens / month`,
      'GitHub PR + MCP included',
      'Email support, 48h response',
      'Billed monthly or yearly',
    ],
    cta: 'Subscribe to Team',
    highlight: true,
  },
  {
    plan: 'pro',
    name: 'Pro',
    blurb: 'For teams with larger review volume',
    features: [
      'Unlimited repos',
      `${PLAN_LIMITS.pro.tokens.toLocaleString()} tokens / month`,
      'GitHub PR + MCP included',
      'Priority support, 24h response',
      'Billed monthly or yearly',
    ],
    cta: 'Subscribe to Pro',
  },
];

const COMPARISON_ROWS: { label: string; values: [string, string, string, string] }[] = [
  {
    label: 'Connected repos',
    values: ['1', '3', '15', 'Unlimited'],
  },
  {
    label: 'Monthly tokens',
    values: [
      PLAN_LIMITS.free.tokens.toLocaleString(),
      PLAN_LIMITS.starter.tokens.toLocaleString(),
      PLAN_LIMITS.team.tokens.toLocaleString(),
      PLAN_LIMITS.pro.tokens.toLocaleString(),
    ],
  },
  {
    label: 'GitHub PR reviews',
    values: ['Included', 'Included', 'Included', 'Included'],
  },
  {
    label: 'IDE via MCP',
    values: ['Included', 'Included', 'Included', 'Included'],
  },
  {
    label: '8-flag risk taxonomy',
    values: ['Included', 'Included', 'Included', 'Included'],
  },
  {
    label: 'Support',
    values: ['Community', 'Community', 'Email, 48h', 'Priority, 24h'],
  },
];

const FAQS = [
  {
    q: 'Is there a free plan?',
    a: 'Yes. The Free plan is permanent and does not require a credit card. Starter, Team, and Pro are paid plans with monthly or yearly billing.',
  },
  {
    q: 'How are tokens counted?',
    a: 'Every PR analysis and MCP analysis consumes tokens from your monthly budget based on actual LLM usage. PR updates and IDE requests share the same pool. Check your dashboard for real-time usage.',
  },
  {
    q: 'What counts as one analysis?',
    a: 'One analysis is one completed review: a PR comment posted, or one MCP review_changes call. Re-running on the same PR after a push counts as a new analysis.',
  },
  {
    q: 'Do you train on our code?',
    a: 'No. Diff content is sent to the LLM provider for the duration of the request and not retained for training. We persist only the structural diff metadata and the generated summary.',
  },
  {
    q: 'Can we self-host?',
    a: 'Not today. The pipeline is open source if you want to read or fork it, but the hosted product is the supported path. Reach out via Feedback if you have a hard self-host requirement.',
  },
  {
    q: 'Which LLM providers do you support?',
    a: 'Anthropic, DeepSeek, Gemini, and Groq are available. DeepSeek is the primary provider in production for reliable structured output at low cost.',
  },
];

function displayPrice(plan: PlanName, period: BillingPeriod): { price: string; cadence: string } {
  if (plan === 'free') {
    return { price: '$0', cadence: '' };
  }
  const rates = PLAN_PRICES[plan];
  const amount = period === 'yearly' ? rates.yearlyMonthly : rates.monthly;
  return {
    price: `$${amount}`,
    cadence: period === 'yearly' ? '/mo, billed yearly' : '/month',
  };
}

export function PricingContent(): React.ReactElement {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  return (
    <main className="border-b border-surface-border">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-hero-dots opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[720px] -translate-x-1/2 bg-glow-green"
        />
        <div className="relative mx-auto max-w-5xl px-5 pb-10 pt-20 text-center sm:px-6 sm:pt-28">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/8 px-3 py-1 text-xs font-mono uppercase tracking-[0.16em] text-accent">
              <Sparkles size={12} aria-hidden />
              Pricing
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-primary sm:text-5xl md:text-6xl">
              Simple pricing. No surprises.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-secondary">
              One subscription covers GitHub PR reviews and IDE integration via MCP. Pay for
              tokens, not seats.
            </p>
          </Reveal>
          <Reveal delay={0.13}>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
              Start free on one repo. Upgrade when your team needs more volume.
            </p>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="mx-auto mt-8 inline-flex items-center rounded-full border border-surface-border bg-surface p-1 text-sm">
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className={`rounded-full px-4 py-2 font-medium transition-colors ${
                  period === 'monthly'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPeriod('yearly')}
                className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors ${
                  period === 'yearly'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Yearly
                <span className="rounded-full bg-risk-low/15 px-1.5 py-0.5 text-[10px] font-semibold text-risk-low">
                  Save 20%
                </span>
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Tier cards */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
        <RevealStagger className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((tier) => {
            const { price, cadence } = displayPrice(tier.plan, period);
            return (
              <RevealItem key={tier.plan}>
                <PricingCard tier={tier} price={price} cadence={cadence} period={period} />
              </RevealItem>
            );
          })}
        </RevealStagger>
      </section>

      {/* Included on every plan */}
      <section className="border-y border-surface-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
          <Reveal>
            <h2 className="text-center text-sm font-mono uppercase tracking-[0.16em] text-muted">
              Included on every plan
            </h2>
          </Reveal>
          <RevealStagger className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <RevealItem>
              <IncludedCard
                icon={GitPullRequest}
                title="GitHub PR reviews"
                description="Automatic behavioral summaries on every pull request, usually within 20–40 seconds."
              />
            </RevealItem>
            <RevealItem>
              <IncludedCard
                icon={Plug}
                title="IDE via MCP"
                description="On-demand risk analysis in Cursor, Claude Code, Windsurf, and other MCP IDEs."
              />
            </RevealItem>
            <RevealItem>
              <IncludedCard
                icon={Zap}
                title="Same analysis engine"
                description="One prompt, one 8-flag risk taxonomy. Comparable results across PR and IDE."
              />
            </RevealItem>
          </RevealStagger>
        </div>
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
        <Reveal>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary sm:text-3xl">Compare plans</h2>
            <p className="mx-auto mt-3 max-w-lg text-secondary">
              All plans include the full Senix analysis. You choose repo limits and monthly token
              budget.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-10 overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-raised">
                  <th className="px-5 py-3.5 text-left font-medium text-muted">Feature</th>
                  {TIERS.map((t) => (
                    <th key={t.plan} className="px-4 py-3.5 text-left font-semibold text-primary">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, ri) => (
                  <tr
                    key={row.label}
                    className={ri % 2 === 0 ? 'bg-surface' : 'bg-surface-raised/30'}
                  >
                    <td className="px-5 py-3.5 font-medium text-secondary">{row.label}</td>
                    {row.values.map((val, ci) => (
                      <td key={ci} className="px-4 py-3.5 text-secondary">
                        {val === 'Included' ? (
                          <Check size={16} className="text-accent" aria-label="Included" />
                        ) : (
                          val
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* PR vs MCP */}
      <section className="mx-auto max-w-4xl px-5 pb-20 sm:px-6">
        <Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-surface-border bg-surface p-6">
              <h3 className="font-semibold text-primary">GitHub PR reviews</h3>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                Run automatically when you open or update a pull request. Senix posts a single
                comment with behavioral summary, risk level, flags, and focus areas.
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface p-6">
              <h3 className="font-semibold text-primary">MCP in your IDE</h3>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                Run on demand when you ask your AI assistant to review changes. Same prompt and
                risk taxonomy, returned in your chat panel before you push.
              </p>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-muted">
            Both surfaces share your monthly token budget.{' '}
            <Link href="/docs" className="text-accent hover:text-accent-hover underline-offset-2 hover:underline">
              Read the docs
            </Link>
          </p>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-28 sm:px-6">
        <Reveal>
          <h2 className="mb-8 text-center text-2xl font-bold text-primary sm:text-3xl">
            Frequently asked
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <Faq items={FAQS} />
        </Reveal>
      </section>
    </main>
  );
}

function PricingCard({
  tier,
  price,
  cadence,
  period,
}: {
  tier: Tier;
  price: string;
  cadence: string;
  period: BillingPeriod;
}): React.ReactElement {
  return (
    <div
      className={`relative flex h-full flex-col rounded-xl border p-6 transition-all duration-150 sm:p-7 ${
        tier.highlight
          ? 'border-accent/40 bg-surface shadow-[0_0_48px_-16px_rgba(22,156,99,0.35)] ring-1 ring-accent/20'
          : 'border-surface-border bg-surface hover:border-neutral-border hover:bg-surface-raised'
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 bg-accent/15 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          Most popular
        </span>
      )}

      <p className="text-sm text-muted">{tier.blurb}</p>
      <h3 className="mt-1 text-xl font-semibold text-primary">{tier.name}</h3>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight tabular-nums text-primary sm:text-5xl">
          {price}
        </span>
        {cadence && <span className="text-sm text-muted">{cadence}</span>}
      </div>

      <ul className="mt-6 flex-1 space-y-2.5">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <Check size={15} strokeWidth={2.5} className="mt-0.5 shrink-0 text-accent" />
            <span className="text-secondary">{feature}</span>
          </li>
        ))}
      </ul>

      <PricingCheckoutButton
        plan={tier.plan}
        label={tier.cta}
        highlight={tier.highlight}
        period={period}
      />
    </div>
  );
}

function IncludedCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof GitPullRequest;
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5 text-center sm:text-left">
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-accent sm:mx-0">
        <Icon size={17} aria-hidden />
      </span>
      <h3 className="mt-4 font-semibold text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-secondary">{description}</p>
    </div>
  );
}
