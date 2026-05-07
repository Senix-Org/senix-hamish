import Link from 'next/link';
import { Check } from 'lucide-react';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { Reveal, RevealItem, RevealStagger } from '@/components/reveal';
import { Faq } from './faq';

type Tier = {
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
    name: 'Hobby',
    price: '$9',
    cadence: '/month',
    blurb: 'For solo developers',
    features: [
      'Up to 3 repos',
      '50 reviews / month',
      '3-sentence behavioral summaries',
      'All 8 risk-flag categories',
      'Community support',
    ],
    cta: 'Start free trial',
  },
  {
    name: 'Team',
    price: '$49',
    cadence: '/month',
    blurb: 'For small teams',
    features: [
      'Up to 10 repos',
      '500 reviews / month',
      'Slack + email digest (soon)',
      'Per-repo enable / disable',
      'Email support',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    name: 'Pro',
    price: '$199',
    cadence: '/month',
    blurb: 'For serious teams',
    features: [
      'Unlimited repos',
      '5,000 reviews / month',
      'Custom risk taxonomy (soon)',
      'Priority support',
      'SSO + audit log (soon)',
    ],
    cta: 'Start free trial',
  },
];

const FAQS = [
  {
    q: 'What does the free trial include?',
    a: 'Every tier starts with a 14-day free trial. No credit card up front. You only enter billing details if you choose to continue at the end of the trial.',
  },
  {
    q: 'How is a "review" counted?',
    a: 'One review = one analysis posted on a PR. If you push three commits to the same PR, that is three reviews. Closed/merged PRs do not get re-analyzed.',
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
    a: 'Anthropic, DeepSeek, Gemini, and Groq are all available — switchable per workspace. Defaults to DeepSeek because it has the most reliable structured-output support at low cost.',
  },
];

/**
 * Public pricing page. Three-tier grid + FAQ. Mirrors the rest of the
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
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-glow-green pointer-events-none"
          />
          <div className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-20 sm:pt-28 pb-12 text-center">
            <Reveal>
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
                Pricing
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-3 text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.02em]">
                Simple pricing. No surprises.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 text-zinc-400 max-w-xl mx-auto leading-relaxed">
                Start free for 14 days. No credit card required.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-24">
          <RevealStagger className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TIERS.map((tier) => (
              <RevealItem key={tier.name}>
                <PricingCard tier={tier} />
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        <section className="max-w-3xl mx-auto px-5 sm:px-6 pb-28">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-10">
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
      className={`relative rounded-xl border p-7 h-full flex flex-col transition-colors ${
        tier.highlight
          ? 'border-green-500/40 bg-zinc-900/70 shadow-2xl shadow-green-950/30'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-2.5 right-6 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500 text-zinc-950">
          Most popular
        </span>
      )}
      <div className="text-sm text-zinc-400">{tier.blurb}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{tier.name}</div>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-5xl font-bold tracking-tight tabular-nums">{tier.price}</span>
        <span className="text-zinc-500">{tier.cadence}</span>
      </div>
      <ul className="mt-7 space-y-3 text-sm flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check
              size={16}
              strokeWidth={2.25}
              className="mt-0.5 text-green-500 shrink-0"
            />
            <span className="text-zinc-300">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/login"
        className={`mt-8 inline-flex items-center justify-center px-4 py-2.5 rounded-md font-medium text-sm transition-colors ${
          tier.highlight
            ? 'bg-green-500 hover:bg-green-400 text-zinc-950'
            : 'border border-zinc-700 hover:border-zinc-600 text-zinc-100 hover:bg-zinc-800/40'
        }`}
      >
        {tier.cta}
      </Link>
    </div>
  );
}
