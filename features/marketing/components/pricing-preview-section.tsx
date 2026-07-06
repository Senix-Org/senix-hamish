'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { PLAN_LIMITS } from '@features/billing/plan-limits';
import { SectionHeading } from './ui/section-heading';
import { MarketingCard } from './ui/card';
import { MarketingButton } from './ui/button';
import { useGsapScrollReveal } from '../hooks/use-gsap-scroll-reveal';

type Tier = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    cadence: '',
    blurb: 'Try Senix on one repo',
    features: [
      `${PLAN_LIMITS.free.repos} repo`,
      `${PLAN_LIMITS.free.tokens.toLocaleString()} tokens / month`,
      'Community support',
    ],
    cta: 'Get started free',
    href: '/login',
  },
  {
    name: 'Team',
    price: '$79',
    cadence: '/month',
    blurb: 'For small teams with shared repos',
    features: [
      `${PLAN_LIMITS.team.repos} repos`,
      `${PLAN_LIMITS.team.tokens.toLocaleString()} tokens / month`,
      'Email support, 48 hour response',
      'Billed monthly',
    ],
    cta: 'Subscribe to Team',
    href: '/pricing',
    highlight: true,
  },
  {
    name: 'Pro',
    price: '$199',
    cadence: '/month',
    blurb: 'For larger review volume',
    features: [
      'Unlimited repos',
      `${PLAN_LIMITS.pro.tokens.toLocaleString()} tokens / month`,
      'Priority support, 24 hour response',
    ],
    cta: 'Subscribe to Pro',
    href: '/pricing',
  },
];

/**
 * Three-tier pricing preview for the landing page.
 */
export function PricingPreviewSection(): React.ReactElement {
  const ref = useGsapScrollReveal<HTMLElement>({
    childSelector: '[data-pricing-card]',
    stagger: 0.1,
  });

  return (
    <section id="pricing" ref={ref} className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
      <SectionHeading
        align="center"
        eyebrow="Pricing"
        title="Simple plans. No surprises."
        description="Start free on one repo. Upgrade when your team ships faster."
        className="mx-auto"
      />

      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <MarketingCard
            key={tier.name}
            highlight={tier.highlight}
            data-pricing-card
            className="relative flex flex-col opacity-0"
          >
            {tier.highlight ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-400">
                Most popular
              </span>
            ) : null}

            <h3 className="text-lg font-semibold text-zinc-100">{tier.name}</h3>
            <p className="mt-1 text-sm text-zinc-500">{tier.blurb}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-zinc-100">{tier.price}</span>
              {tier.cadence ? (
                <span className="text-sm text-zinc-500">{tier.cadence}</span>
              ) : null}
            </div>

            <ul className="mt-6 flex-1 space-y-2.5">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                  <Check size={14} className="mt-0.5 shrink-0 text-green-500" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>

            <MarketingButton
              href={tier.href}
              variant={tier.highlight ? 'primary' : 'secondary'}
              className="mt-8 w-full !h-auto py-3"
            >
              {tier.cta}
            </MarketingButton>
          </MarketingCard>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Need Starter or annual billing?{' '}
        <Link href="/pricing" className="text-green-500 hover:text-green-400 transition">
          See full pricing
        </Link>
      </p>
    </section>
  );
}
