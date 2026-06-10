import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { SiteNav } from '@features/shared/components/site-nav';
import { SiteFooter } from '@features/shared/components/site-footer';
import { Reveal, RevealItem, RevealStagger } from '@features/shared/components/reveal';
import { PLAN_LIMITS } from '@features/billing/plan-limits';
import { buildMetadata } from '@/lib/seo';
import { Faq } from './faq';
import { PricingCheckoutButton } from './pricing-checkout-button';

export const metadata: Metadata = buildMetadata({
  title: 'Pricing',
  description:
    'Simple pricing for every team size. Free plan available. No credit card required.',
  path: '/pricing',
});

type Tier = {
  plan: 'free' | 'starter' | 'team' | 'pro';
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    plan: 'free',
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
  },
  {
    plan: 'starter',
    name: 'Starter',
    price: '$18',
    cadence: '/month',
    blurb: 'For solo developers shipping often',
    features: [
      `${PLAN_LIMITS.starter.repos} repos`,
      `${PLAN_LIMITS.starter.tokens.toLocaleString()} tokens per month`,
      'Community support',
      'Billed monthly',
    ],
    cta: 'Subscribe to Starter',
  },
  {
    plan: 'team',
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
    highlight: true,
  },
  {
    plan: 'pro',
    name: 'Pro',
    price: '$199',
    cadence: '/month',
    blurb: 'For teams with larger review volume',
    features: [
      'Unlimited repos',
      `${PLAN_LIMITS.pro.tokens.toLocaleString()} tokens per month`,
      'Priority support, 24 hour response',
      'Billed monthly',
    ],
    cta: 'Subscribe to Pro',
  },
];

const FAQS = [
  {
    q: 'Is there a free plan?',
    a: 'Yes. The Free plan is permanent and does not require payment. Starter, Team, and Pro are paid monthly plans.',
  },
  {
    q: 'How is a "review" counted?',
    a: 'One review is one PR analysis or one MCP analysis. PR updates and IDE requests both count toward the same monthly limit.',
  },
  {
    q: 'Do you train on our code?',
    a: 'No. PR contents are sent to the LLM provider you choose for the duration of the request and not retained for training. We persist only the structural diff and the generated summary, both visible in your dashboard.',
  },
  {
    q: 'Can we self-host?',
    a: 'Not today. The pipeline is open source if you want to read or fork it, but the hosted product is the supported path. Reach out if you have a hard self-host requirement.',
  },
  {
    q: 'Which LLM providers do you support?',
    a: 'Anthropic, DeepSeek, Gemini, and Groq are available. DeepSeek is the default because it has reliable structured output support at low cost.',
  },
];

/**
 * Public pricing page. Four-tier grid + FAQ. Mirrors the rest of the
 * marketing surface: SiteNav, sectioned content, Reveal-on-scroll,
 * SiteFooter.
 */
export default function PricingPage(): React.ReactElement {
  return (
    <>
      <SiteNav />
      <main className="border-b border-zinc-800/40">
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 bg-grid opacity-50" />
          <div
            aria-hidden
            className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 bg-glow-green pointer-events-none"
          />
          <div className="relative mx-auto max-w-5xl px-5 pb-12 pt-20 text-center sm:px-6 sm:pt-28">
            <Reveal>
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
                Pricing
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-3 text-4xl font-bold sm:text-5xl md:text-6xl">
                Simple pricing. No surprises.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-5 max-w-xl leading-relaxed text-zinc-200">
                One subscription. GitHub PR reviews + IDE integration via MCP.
              </p>
            </Reveal>
            <Reveal delay={0.13}>
              <p className="mx-auto mt-2 max-w-xl leading-relaxed text-zinc-400">
                Start free. Upgrade when your team needs more.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-6">
          <RevealStagger className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <RevealItem key={tier.name}>
                <PricingCard tier={tier} />
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-20 sm:px-6">
          <Reveal>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-7">
              <h2 className="text-xl font-semibold text-zinc-100">
                What&apos;s the difference between PR and MCP analyses?
              </h2>
              <p className="mt-3 leading-relaxed text-zinc-400">
                PR analyses run automatically when you open or update a pull request. MCP
                analyses run on demand when you ask your IDE&apos;s AI to review your
                changes. Both use the same prompt and risk taxonomy.
              </p>
            </div>
          </Reveal>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-28 sm:px-6">
          <Reveal>
            <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
              Frequently asked
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <Faq items={FAQS} />
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PricingCard({ tier }: { tier: Tier }): React.ReactElement {
  return (
    <div
      className={`relative flex h-full flex-col rounded-xl border p-7 transition-colors ${
        tier.highlight
          ? 'border-green-500/40 bg-zinc-900/70 shadow-2xl shadow-green-950/30'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-2.5 right-6 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-950">
          Most popular
        </span>
      )}
      <div className="text-sm text-zinc-400">{tier.blurb}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{tier.name}</div>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-5xl font-bold tracking-tight tabular-nums">{tier.price}</span>
        <span className="text-zinc-500">{tier.cadence}</span>
      </div>
      <ul className="mt-7 flex-1 space-y-3 text-sm">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-green-500" />
            <span className="text-zinc-300">{feature}</span>
          </li>
        ))}
      </ul>
      <PricingCheckoutButton plan={tier.plan} label={tier.cta} highlight={tier.highlight} />
    </div>
  );
}
