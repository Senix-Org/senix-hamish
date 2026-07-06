'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  ChevronUp,
  CreditCard,
  GitPullRequest,
  Key,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Plug,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SignOutButton from '@features/shared/components/sign-out-button';
import { FeedbackModal } from '@features/dashboard/components/feedback-modal';

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Reviews', href: '/dashboard/reviews', icon: GitPullRequest },
  { label: 'Connect IDE', href: '/dashboard/connect', icon: Plug },
  { label: 'Tokens', href: '/dashboard/tokens', icon: Key },
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { label: 'Docs', href: '/docs', icon: BookOpen, external: true },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsOf(handle: string): string {
  const clean = handle.replace(/[^a-zA-Z0-9]/g, '');
  return (clean.slice(0, 2) || 'Y').toUpperCase();
}

export function DashboardSidebar({
  handle,
  avatarUrl,
}: {
  handle: string;
  avatarUrl?: string;
}): React.ReactElement {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDrawerOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  const labelHidden = expanded ? '' : 'md:hidden';
  const railCenter = expanded ? '' : 'md:justify-center';

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-surface-border bg-base/95 px-4 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-primary"
        >
          <Menu size={20} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-6 w-6 rounded-md ring-1 ring-surface-border" />
          <span className="font-mono text-sm text-primary">senix</span>
        </Link>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-base/80 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setExpanded(false);
          }
        }}
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col overflow-hidden border-r border-surface-border bg-surface transition-[width,transform,box-shadow] duration-200 ease-out md:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        } ${expanded ? 'md:w-60 md:shadow-2xl md:shadow-black/50' : 'md:w-16'}`}
      >
        <div
          className={`flex h-16 shrink-0 items-center justify-between border-b border-surface-border px-5 ${
            expanded ? '' : 'md:justify-center md:px-0'
          }`}
        >
          <Link href="/dashboard" className="group flex items-center gap-2">
            <img
              src="/logo.png"
              alt=""
              className="h-7 w-7 shrink-0 rounded-md ring-1 ring-surface-border transition group-hover:ring-accent/40"
            />
            <span className={`font-mono text-sm tracking-tight text-primary ${labelHidden}`}>
              senix
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="rounded-lg p-1 text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-primary md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4">
          <p
            className={`mb-2 px-3 text-[10px] font-mono uppercase tracking-[0.14em] text-muted ${labelHidden}`}
          >
            Menu
          </p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = !item.external && isActive(pathname, item.href);
              const Icon = item.icon;
              const className = `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${railCenter} ${
                active
                  ? 'bg-accent/12 text-accent'
                  : 'text-secondary hover:bg-surface-raised hover:text-primary'
              }`;
              const inner = (
                <>
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
                  )}
                  <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                  <span className={`whitespace-nowrap ${labelHidden}`}>{item.label}</span>
                </>
              );

              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={item.label}
                    className={className}
                  >
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={item.href} href={item.href} title={item.label} className={className}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-surface-border p-3">
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
              expanded ? '' : 'md:justify-center md:px-0'
            }`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full ring-1 ring-surface-border"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-secondary">
                {initialsOf(handle)}
              </span>
            )}
            <span className={`min-w-0 flex-1 truncate text-sm text-primary ${labelHidden}`}>
              {handle}
            </span>
            <ChevronUp size={15} className={`shrink-0 text-muted ${labelHidden}`} />
          </div>

          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            title="Feedback"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-primary ${railCenter}`}
          >
            <MessageSquare size={18} strokeWidth={1.75} className="shrink-0" />
            <span className={`whitespace-nowrap ${labelHidden}`}>Feedback</span>
          </button>

          <SignOutButton collapsed={!expanded} />
        </div>
      </aside>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}
