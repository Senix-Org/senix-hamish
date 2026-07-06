import type { ReactNode } from 'react';

/**
 * Consistent page header for dashboard routes. Eyebrow label, title,
 * optional description, and an optional right-side action slot.
 */
export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}): React.ReactElement {
  return (
    <header className="border-b border-surface-border pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-accent">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {eyebrow}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
