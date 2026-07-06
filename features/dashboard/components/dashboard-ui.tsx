import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * Metric tile for the dashboard overview grid.
 */
export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
}): React.ReactElement {
  return (
    <div className="relative overflow-hidden rounded-xl border border-surface-border bg-surface p-5 transition-colors duration-150 hover:border-neutral-border hover:bg-surface-raised">
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-accent/5 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-bold leading-none tabular-nums text-primary">{value}</div>
          <div className="mt-2 text-xs font-medium uppercase tracking-wider text-secondary">
            {label}
          </div>
          {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-accent">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </div>
      </div>
    </div>
  );
}

/**
 * Section wrapper with title row and optional header action.
 */
export function DashboardSection({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <section className={className}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-primary">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Horizontal quick-link card for dashboard shortcuts.
 */
export function DashboardQuickLink({
  href,
  title,
  description,
  icon: Icon,
  external,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  external?: boolean;
}): React.ReactElement {
  const className =
    'group flex flex-1 min-w-[200px] items-start gap-3 rounded-xl border border-surface-border bg-surface p-4 transition-all duration-150 hover:border-accent/30 hover:bg-surface-raised';

  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-accent transition-colors group-hover:border-accent/30">
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-primary">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted">{description}</div>
      </div>
    </>
  );

  if (external) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

/**
 * Monthly token usage meter. Shown on the overview when plan data is available.
 */
export function DashboardUsageMeter({
  used,
  limit,
  planLabel,
}: {
  used: number;
  limit: number;
  planLabel: string;
}): React.ReactElement {
  const percent = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone =
    percent >= 100 ? 'bg-risk-high' : percent >= 80 ? 'bg-risk-medium' : 'bg-accent';

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted">Token usage</p>
          <p className="mt-1 text-sm text-secondary">
            <span className="font-semibold tabular-nums text-primary">{used.toLocaleString()}</span>
            {' '}
            of {limit.toLocaleString()} this month
          </p>
        </div>
        <span className="rounded-md border border-surface-border bg-surface-raised px-2 py-0.5 text-xs font-medium text-secondary">
          {planLabel} plan
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{percent}% used</span>
        {percent >= 80 && (
          <Link href="/dashboard/billing" className="text-accent hover:text-accent-hover">
            {percent >= 100 ? 'Upgrade to continue' : 'View billing'}
          </Link>
        )}
      </div>
    </div>
  );
}
