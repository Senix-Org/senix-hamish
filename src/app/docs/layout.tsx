import { SiteNav } from '@features/shared/components/site-nav';
import { DocsSidebar } from '@features/shared/components/docs/docs-sidebar';

/**
 * Docs shell. Fixed nav + sidebar frame; content column scrolls independently.
 */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-screen flex-col bg-base text-primary">
      <SiteNav />
      <div className="relative flex min-h-0 flex-1">
        <div
          className="pointer-events-none absolute inset-0 bg-hero-dots opacity-40"
          aria-hidden
        />
        <DocsSidebar />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <article className="mx-auto max-w-3xl px-6 py-10 pb-24 sm:px-10 sm:py-14">
            {children}
          </article>
        </main>
      </div>
    </div>
  );
}
