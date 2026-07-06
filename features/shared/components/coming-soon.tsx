import { SiteNav } from '@features/shared/components/site-nav';
import { TraeFooterSection } from '@features/marketing/components/trae/footer-section';

/**
 * Minimal "coming soon" scaffold for public placeholder routes. Reuses the
 * marketing nav and footer so these pages feel part of the site, with a
 * single centered heading and one honest line of copy.
 */
export function ComingSoon({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}): React.ReactElement {
  return (
    <>
      <SiteNav />
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-5 py-24 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-zinc-100">
          {title}
        </h1>
        <p className="mt-4 max-w-md text-zinc-400 leading-relaxed">{subtitle}</p>
      </main>
      <TraeFooterSection />
    </>
  );
}
