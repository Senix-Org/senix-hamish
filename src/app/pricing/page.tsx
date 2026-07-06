import type { Metadata } from 'next';
import { SiteNav } from '@features/shared/components/site-nav';
import { TraeFooterSection } from '@features/marketing/components/trae/footer-section';
import { buildMetadata } from '@/lib/seo';
import { PricingContent } from './pricing-content';

export const metadata: Metadata = buildMetadata({
  title: 'Pricing',
  description:
    'Simple pricing for every team size. Free plan available. No credit card required.',
  path: '/pricing',
});

export default function PricingPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-base text-primary">
      <SiteNav />
      <PricingContent />
      <TraeFooterSection />
    </div>
  );
}
