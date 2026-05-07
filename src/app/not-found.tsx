import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';

/**
 * Brand-consistent 404 page. Same nav and footer as the rest of the
 * marketing surface so the visitor doesn't feel kicked out — just
 * misrouted.
 */
export default function NotFound(): React.ReactElement {
  return (
    <>
      <SiteNav />
      <main className="relative overflow-hidden border-b border-zinc-800/40">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-50" />
        <div
          aria-hidden
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-glow-green pointer-events-none"
        />
        <div className="relative max-w-2xl mx-auto px-5 sm:px-6 py-32 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-green-500/80">
            404
          </span>
          <h1 className="mt-4 text-5xl sm:text-6xl font-bold tracking-[-0.02em]">
            We couldn&apos;t find that page.
          </h1>
          <p className="mt-5 text-zinc-400 leading-relaxed">
            The link may be stale, mistyped, or pointing at something we haven&apos;t shipped yet.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="px-5 py-3 rounded-md bg-green-500 hover:bg-green-400 text-zinc-950 font-medium text-sm transition"
            >
              Back to home
            </Link>
            <Link
              href="/docs"
              className="px-5 py-3 rounded-md border border-zinc-800 hover:border-zinc-700 text-zinc-200 font-medium text-sm transition"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
