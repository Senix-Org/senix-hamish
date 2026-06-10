import Link from 'next/link';
import type { ReactNode } from 'react';
import { DesktopAuthCta } from './auth-cta';
import { MobileMenu } from './site-nav-mobile';
import { StickyHeader } from './sticky-header';

export type NavLink = {
  label: string;
  href: string;
};

export const PRIMARY_NAV_LINKS: NavLink[] = [
  { label: 'Product', href: '/#product' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
];

type SiteNavProps = {
  /**
   * Replaces the default "Sign in / Get started" cluster on the right.
   * Used by the dashboard layout to render avatar / feedback / sign-out.
   */
  rightSlot?: ReactNode;
};

/**
 * Sticky top navigation shared across the public marketing surface and
 * the authenticated dashboard. The middle nav links remain identical in
 * both modes so users always know where they are; the right-hand cluster
 * swaps via `rightSlot`.
 */
export function SiteNav({ rightSlot }: SiteNavProps = {}): React.ReactElement {
  const right = rightSlot ?? <PublicAuthCluster />;

  return (
    <StickyHeader>
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <img
            src="/logo.png"
            alt=""
            className="h-7 w-7 rounded-md ring-1 ring-zinc-800 group-hover:ring-green-500/40 transition"
          />
          <span className="font-mono text-sm tracking-tight text-zinc-100">senix</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm">
          {PRIMARY_NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3 shrink-0">{right}</div>

        <MobileMenu links={PRIMARY_NAV_LINKS} />
      </div>
    </StickyHeader>
  );
}

function PublicAuthCluster(): React.ReactElement {
  return <DesktopAuthCta />;
}
