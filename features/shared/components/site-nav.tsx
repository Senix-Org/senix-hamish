import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavLink as MarketingNavLink } from '@features/marketing/components/nav-link';
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
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
];

type SiteNavProps = {
  /**
   * Replaces the default "Sign in / Get started" cluster on the right.
   * Used by the dashboard layout to render avatar / feedback / sign-out.
   */
  rightSlot?: ReactNode;
  /** TRAE-style minimal nav for the landing page hero. */
  variant?: 'default' | 'trae';
};

/**
 * Sticky top navigation shared across the public marketing surface and
 * the authenticated dashboard. The middle nav links remain identical in
 * both modes so users always know where they are; the right-hand cluster
 * swaps via `rightSlot`.
 */
export function SiteNav({ rightSlot, variant = 'default' }: SiteNavProps = {}): React.ReactElement {
  const right = rightSlot ?? <PublicAuthCluster variant={variant} />;
  const isTrae = variant === 'trae';

  return (
    <StickyHeader variant={variant}>
      <div
        className={
          isTrae
            ? 'trae-nav-inner flex h-16 items-center justify-between gap-6'
            : 'max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-6'
        }
      >
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <img
            src="/logo.png"
            alt=""
            className={`h-7 w-7 rounded-md transition ${
              isTrae ? 'ring-1 ring-white/10 group-hover:ring-[#32f08c]/50' : 'ring-1 ring-zinc-800 group-hover:ring-green-500/40'
            }`}
          />
          <span
            className={`text-sm tracking-tight font-semibold ${isTrae ? 'text-white' : 'font-mono text-zinc-100'}`}
          >
            senix
          </span>
        </Link>

        <nav
          className={`hidden md:flex items-center text-sm ${isTrae ? 'gap-8' : 'gap-7'}`}
          aria-label="Primary"
        >
          {PRIMARY_NAV_LINKS.map((l) => (
            <MarketingNavLink
              key={l.href}
              href={l.href}
              className={isTrae ? 'text-[#c9c5d2] hover:text-white' : undefined}
            >
              {l.label}
            </MarketingNavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3 shrink-0">{right}</div>

        <MobileMenu links={PRIMARY_NAV_LINKS} variant={variant} />
      </div>
    </StickyHeader>
  );
}

function PublicAuthCluster({ variant }: { variant: 'default' | 'trae' }): React.ReactElement {
  return <DesktopAuthCta trae={variant === 'trae'} />;
}
