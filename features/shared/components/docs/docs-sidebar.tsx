'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Menu, X } from 'lucide-react';

type DocLink = { label: string; href: string };
type DocGroup = { heading: string; links: DocLink[] };

const NAV: DocGroup[] = [
  {
    heading: 'Getting started',
    links: [
      { label: 'Introduction', href: '/docs' },
      { label: 'Installation', href: '/docs/installation' },
    ],
  },
  {
    heading: 'Usage',
    links: [
      { label: 'How it works', href: '/docs/how-it-works' },
      { label: 'Risk flags', href: '/docs/risk-flags' },
      { label: 'MCP for IDEs', href: '/docs/mcp' },
    ],
  },
  {
    heading: 'Reference',
    links: [
      { label: 'Configuration', href: '/docs/configuration' },
      { label: 'Troubleshooting', href: '/docs/troubleshooting' },
      { label: 'FAQ', href: '/docs/faq' },
      { label: 'API', href: '/docs/api' },
    ],
  },
];

/**
 * Docs sidebar navigation. Fixed on desktop; slide-over drawer on mobile.
 */
export function DocsSidebar(): React.ReactElement {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="hidden md:flex w-64 shrink-0 flex-col border-r border-surface-border bg-surface">
        <div className="border-b border-surface-border px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-accent">
              <BookOpen size={15} aria-hidden />
            </span>
            <div>
              <p className="font-mono text-sm font-medium text-primary">Documentation</p>
              <p className="text-xs text-muted">Guides & reference</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <NavGroups pathname={pathname} />
        </div>
      </nav>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed left-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-4 py-2.5 text-sm text-primary shadow-lg shadow-black/40"
      >
        <Menu size={16} />
        Docs menu
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-base/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <nav
            className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-surface-border bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-accent" aria-hidden />
                <span className="font-mono text-sm text-primary">Documentation</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
                className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <NavGroups pathname={pathname} />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function NavGroups({ pathname }: { pathname: string }): React.ReactElement {
  return (
    <div className="space-y-8">
      {NAV.map((group) => (
        <div key={group.heading}>
          <div className="mb-2.5 px-2 text-[11px] font-mono uppercase tracking-[0.16em] text-muted">
            {group.heading}
          </div>
          <ul className="space-y-0.5">
            {group.links.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block rounded-md px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? 'border-l-2 border-accent bg-accent/8 pl-[calc(0.625rem-2px)] font-medium text-accent'
                        : 'border-l-2 border-transparent text-secondary hover:bg-surface-raised hover:text-primary'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
