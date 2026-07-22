import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SiteNav } from '@features/shared/components/site-nav';
import { TraeHeroSection } from '@features/marketing/components/trae/hero-section';
import { TraeIntegrationsMarquee } from '@features/marketing/components/trae/integrations-marquee';
import { buildMetadata } from '@/lib/seo';
import { JsonLd, landingSchemas } from '@/components/json-ld';

// ── Above-fold: static imports (always in the initial JS bundle) ─────────────
// Hero and marquee are visible immediately; they stay in the main chunk.

// ── Below-fold: code-split with next/dynamic ─────────────────────────────────
// Each section becomes its own lazy chunk that the browser loads only when
// React renders it (server renders HTML immediately; JS hydration is deferred).

// Minimal height fallbacks prevent layout shift while chunks download.
const SectionFallback = ({ h = 480 }: { h?: number }) => (
  <div style={{ minHeight: h }} aria-hidden />
);

const TraeDemoSection = dynamic(
  () => import('@features/marketing/components/trae/demo-section').then((m) => ({ default: m.TraeDemoSection })),
  { loading: () => <SectionFallback h={560} /> },
);

const TraeFeaturesSection = dynamic(
  () => import('@features/marketing/components/trae/features-section').then((m) => ({ default: m.TraeFeaturesSection })),
  { loading: () => <SectionFallback h={640} /> },
);

const TraeCompareSection = dynamic(
  () => import('@features/marketing/components/trae/compare-section').then((m) => ({ default: m.TraeCompareSection })),
  { loading: () => <SectionFallback h={480} /> },
);

const TraeStatsSection = dynamic(
  () => import('@features/marketing/components/trae/stats-section').then((m) => ({ default: m.TraeStatsSection })),
  { loading: () => <SectionFallback h={400} /> },
);

const TraeTestimonialsSection = dynamic(
  () => import('@features/marketing/components/trae/testimonials-section').then((m) => ({ default: m.TraeTestimonialsSection })),
  { loading: () => <SectionFallback h={360} /> },
);

const TraePricingSection = dynamic(
  () => import('@features/marketing/components/trae/pricing-section').then((m) => ({ default: m.TraePricingSection })),
  { loading: () => <SectionFallback h={480} /> },
);

const TraePrivacySection = dynamic(
  () => import('@features/marketing/components/trae/privacy-section').then((m) => ({ default: m.TraePrivacySection })),
  { loading: () => <SectionFallback h={320} /> },
);

const TraeFinalCtaSection = dynamic(
  () => import('@features/marketing/components/trae/final-cta-section').then((m) => ({ default: m.TraeFinalCtaSection })),
  { loading: () => <SectionFallback h={280} /> },
);

const TraeFooterSection = dynamic(
  () => import('@features/marketing/components/trae/footer-section').then((m) => ({ default: m.TraeFooterSection })),
  { loading: () => <SectionFallback h={200} /> },
);

// CardBeamEffect returns null — SSR renders nothing, effect runs after hydration.
const CardBeamEffect = dynamic(() =>
  import('@features/marketing/components/card-beam-effect').then((m) => ({ default: m.CardBeamEffect })),
);

export const metadata: Metadata = buildMetadata({
  title: 'Senix — AI Code Review for Pull Requests',
  path: '/',
  absoluteTitle: true,
  keywords: [
    'ai code review',
    'pull request review',
    'github code review',
    'automated code review',
    'cursor code review',
    'claude code review',
    'vibe coding tools',
    'pr review bot',
  ],
});

type HomeSearchParams = { code?: string; next?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  if (params.code) {
    const next = params.next ?? '/dashboard';
    redirect(
      `/auth/callback?code=${encodeURIComponent(params.code)}&next=${encodeURIComponent(next)}`,
    );
  }

  return (
    <div className="trae-site">
      <JsonLd data={landingSchemas} />
      {/* CodeRabbit-inspired fixed page-top green gradient mesh */}
      <div className="trae-page-gradient" aria-hidden />
      {/* CardBeamEffect: no SSR, no main-thread cost at startup */}
      <CardBeamEffect />
      <SiteNav variant="trae" />
      <main>
        {/* Above the fold — always in the primary bundle */}
        <TraeHeroSection />
        <TraeIntegrationsMarquee />
        {/* Below the fold — dynamically chunked */}
        <TraeDemoSection />
        <TraeFeaturesSection />
        <TraeCompareSection />
        <TraeStatsSection />
        <TraeTestimonialsSection />
        <TraePricingSection />
        <TraePrivacySection />
        <TraeFinalCtaSection />
      </main>
      <TraeFooterSection />
    </div>
  );
}
