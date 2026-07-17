'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { PLAN_LIMITS } from '@features/billing/plans';
import { TraeButton } from '../ui/trae-button';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useTraeReveal } from '../../hooks/use-trae-reveal';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    cadence: '',
    blurb: 'For trying Senix on one repo',
    features: [
      `${PLAN_LIMITS.free.repos} repo`,
      `${PLAN_LIMITS.free.tokens.toLocaleString()} tokens per month`,
      'Community support',
      'Permanent free plan',
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
      `${PLAN_LIMITS.team.tokens.toLocaleString()} tokens per month`,
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
    blurb: 'For teams with larger review volume',
    features: [
      'Unlimited repos',
      `${PLAN_LIMITS.pro.tokens.toLocaleString()} tokens per month`,
      'Priority support, 24 hour response',
    ],
    cta: 'Subscribe to Pro',
    href: '/pricing',
  },
];

/** TRAE-style pricing grid with Senix plans. */
export function TraePricingSection(): React.ReactElement {
  const ref = useTraeReveal<HTMLElement>({ childSelector: '[data-trae-item]', stagger: 0.08 });
  const gridRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

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

  return (
    <section id="pricing" ref={ref} className="trae-section py-20 md:py-28">
      <div data-trae-item className="opacity-0">
        <p className="trae-section-label">Pricing</p>
        <h2 className="trae-section-title">Simple plans. No surprises.</h2>
        <p className="trae-section-desc">
          Start free on one repo. Upgrade when your team ships faster.
        </p>
      </div>

      <div ref={gridRef} className="mt-12 grid gap-4 md:grid-cols-3">
        {TIERS.map((tier) => (
          <article
            key={tier.name}
            data-trae-item
            data-pricing-highlight={tier.highlight ? true : undefined}
            className={`trae-card relative flex flex-col p-6 opacity-0 ${
              tier.highlight ? 'border-[#32f08c]/40 shadow-[0_0_40px_-12px_rgba(50,240,140,0.25)]' : ''
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

            <h3 className="text-lg font-medium text-[#f5f9fe]">{tier.name}</h3>
            <p className="mt-1 text-sm text-[#787d87]">{tier.blurb}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span
                className={`text-4xl font-medium tracking-tight ${
                  tier.highlight ? 'trae-gradient-text' : 'text-[#f5f9fe]'
                }`}
              >
                {tier.price}
              </span>
              {tier.cadence ? <span className="text-sm text-[#787d87]">{tier.cadence}</span> : null}
            </div>

            <ul className="mt-6 flex-1 space-y-2.5">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#a6aab5]">
                  <Check size={14} className="mt-0.5 shrink-0 text-[#32f08c]" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>

            <TraeButton
              href={tier.href}
              variant={tier.highlight ? 'brand' : 'outline'}
              className="mt-8 h-11 w-full xl:h-14"
            >
              {tier.cta}
            </TraeButton>
          </article>
        ))}
      </div>

      <p data-trae-item className="mt-8 text-center text-sm text-[#787d87] opacity-0">
        Need Starter or annual billing?{' '}
        <Link href="/pricing" className="text-[#32f08c] hover:text-[#3ecf8e]">
          See full pricing
        </Link>
      </p>
    </section>
  );
}
