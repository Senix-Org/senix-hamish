import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Info,
  Lightbulb,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared presentational primitives for docs pages. Pure server components
 * aligned with Senix design tokens (surface, accent, primary, muted).
 */

export function DocH1({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary">{children}</h1>
  );
}

export function DocLead({ children }: { children: ReactNode }): React.ReactElement {
  return <p className="mt-4 text-lg text-secondary leading-relaxed max-w-2xl">{children}</p>;
}

export function DocH2({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}): React.ReactElement {
  return (
    <h2
      id={id}
      className="text-xl sm:text-2xl font-semibold mt-14 mb-4 scroll-mt-24 text-primary border-b border-surface-border pb-3"
    >
      {children}
    </h2>
  );
}

export function DocH3({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}): React.ReactElement {
  return (
    <h3 id={id} className="text-lg font-semibold mt-8 mb-3 scroll-mt-24 text-primary">
      {children}
    </h3>
  );
}

export function DocP({ children }: { children: ReactNode }): React.ReactElement {
  return <p className="mt-4 text-secondary leading-relaxed">{children}</p>;
}

export function DocUL({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <ul className="mt-4 space-y-2.5 list-disc pl-5 text-secondary leading-relaxed marker:text-accent/60">
      {children}
    </ul>
  );
}

export function DocOL({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <ol className="mt-4 space-y-2.5 list-decimal pl-5 text-secondary leading-relaxed marker:text-muted marker:font-mono">
      {children}
    </ol>
  );
}

export function InlineCode({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <code className="rounded border border-surface-border bg-surface-raised px-1.5 py-0.5 text-sm font-mono text-accent-hover">
      {children}
    </code>
  );
}

export function CodeBlock({
  children,
  label,
}: {
  children: string;
  label?: string;
}): React.ReactElement {
  return (
    <div className="mt-4">
      {label && (
        <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted">
          <span className="h-px flex-1 bg-surface-border" />
          {label}
          <span className="h-px flex-1 bg-surface-border" />
        </div>
      )}
      <pre className="overflow-x-auto rounded-lg border border-surface-border bg-surface p-4 font-mono text-sm leading-relaxed text-primary/90">
        {children}
      </pre>
    </div>
  );
}

export function DocLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Link href={href} className="text-accent hover:text-accent-hover transition-colors underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

type CalloutVariant = 'info' | 'tip' | 'warning';

const CALLOUT_STYLES: Record<
  CalloutVariant,
  { icon: LucideIcon; border: string; bg: string; iconColor: string }
> = {
  info: {
    icon: Info,
    border: 'border-accent/25',
    bg: 'bg-accent/5',
    iconColor: 'text-accent',
  },
  tip: {
    icon: Lightbulb,
    border: 'border-risk-low/25',
    bg: 'bg-risk-low/5',
    iconColor: 'text-risk-low',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-risk-medium/25',
    bg: 'bg-risk-medium/5',
    iconColor: 'text-risk-medium',
  },
};

/** Info, tip, or warning callout box (CodeRabbit-style). */
export function DocCallout({
  variant = 'info',
  title,
  children,
}: {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
}): React.ReactElement {
  const style = CALLOUT_STYLES[variant];
  const Icon = style.icon;

  return (
    <div
      className={`mt-6 flex gap-3 rounded-lg border ${style.border} ${style.bg} px-4 py-3.5`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${style.iconColor}`} aria-hidden />
      <div className="min-w-0 text-sm leading-relaxed text-secondary">
        {title && <p className="mb-1 font-medium text-primary">{title}</p>}
        {children}
      </div>
    </div>
  );
}

type BadgeVariant = 'default' | 'accent' | 'soon' | 'high' | 'medium' | 'low';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  default: 'border-surface-border bg-surface-raised text-secondary',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  soon: 'border-surface-border bg-surface text-muted',
  high: 'border-risk-high/30 bg-risk-high/10 text-risk-high',
  medium: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
  low: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
};

export function DocBadge({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[variant]}`}
    >
      {children}
    </span>
  );
}

/** Linked navigation card with optional icon and arrow. */
export function DocCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-surface-border bg-surface p-5 transition-all duration-150 hover:border-accent/35 hover:bg-surface-raised"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-accent transition-colors group-hover:border-accent/30">
              <Icon size={16} aria-hidden />
            </span>
          )}
          <span className="font-semibold text-primary">{title}</span>
        </div>
        <ChevronRight
          size={16}
          className="mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
          aria-hidden
        />
      </div>
      <p className="mt-2.5 text-sm text-muted leading-relaxed">{description}</p>
    </Link>
  );
}

/** Responsive grid of DocCards. */
export function DocCardGroup({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}): React.ReactElement {
  const colClass =
    cols === 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : cols === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2';

  return <div className={`mt-6 grid grid-cols-1 gap-3 ${colClass}`}>{children}</div>;
}

/** Numbered step list with visual markers. */
export function DocSteps({ children }: { children: ReactNode }): React.ReactElement {
  return <ol className="mt-6 space-y-0">{children}</ol>;
}

export function DocStep({
  step,
  title,
  children,
}: {
  step: number;
  title?: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-xs font-semibold text-accent">
          {step}
        </span>
        <span className="mt-2 w-px flex-1 bg-surface-border last:hidden" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {title && <p className="font-medium text-primary">{title}</p>}
        <div className={`text-sm leading-relaxed text-secondary ${title ? 'mt-1.5' : ''}`}>
          {children}
        </div>
      </div>
    </li>
  );
}

/**
 * Full-width table with subtle borders and alternating row colors.
 */
export function DocTable({
  head,
  rows,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
}): React.ReactElement {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-raised text-left">
          <tr>
            {head.map((cell, i) => (
              <th
                key={i}
                className="border-b border-surface-border px-4 py-3 font-medium text-muted first:rounded-tl-xl last:rounded-tr-xl"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? 'bg-surface' : 'bg-surface-raised/40'}
            >
              {row.map((cell, ci) => (
                <td key={ci} className="border-b border-surface-border/60 px-4 py-3 text-secondary align-top last:border-b-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** FAQ accordion-style card. */
export function DocFaqItem({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5 transition-colors hover:border-neutral-border">
      <h2 className="text-base font-semibold text-primary">{question}</h2>
      <div className="mt-2.5 text-sm leading-relaxed text-secondary">{children}</div>
    </div>
  );
}

/** Two-column feature comparison cards. */
export function DocCompareCards({
  left,
  right,
}: {
  left: { title: string; children: ReactNode };
  right: { title: string; children: ReactNode };
}): React.ReactElement {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[left, right].map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-surface-border bg-surface p-5"
        >
          <h3 className="font-semibold text-primary">{card.title}</h3>
          <div className="mt-3 text-sm leading-relaxed text-secondary">{card.children}</div>
        </div>
      ))}
    </div>
  );
}

/** Troubleshooting issue block. */
export function DocIssue({
  title,
  cause,
  fix,
}: {
  title: string;
  cause: ReactNode;
  fix: ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5">
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      <div className="mt-4 space-y-3 text-sm">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-risk-medium">
            Cause
          </span>
          <p className="mt-1 leading-relaxed text-secondary">{cause}</p>
        </div>
        <div className="border-t border-surface-border pt-3">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">
            Fix
          </span>
          <p className="mt-1 leading-relaxed text-secondary">{fix}</p>
        </div>
      </div>
    </div>
  );
}

/** Page header with optional badge row. */
export function DocPageHeader({
  badge,
  title,
  lead,
}: {
  badge?: ReactNode;
  title: string;
  lead: ReactNode;
}): React.ReactElement {
  return (
    <header className="relative">
      {badge && <div className="mb-4 flex flex-wrap items-center gap-2">{badge}</div>}
      <DocH1>{title}</DocH1>
      <DocLead>{lead}</DocLead>
    </header>
  );
}

/** Horizontal CTA strip at the bottom of a doc page. */
export function DocNextLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className="group mt-16 flex items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface p-5 transition-all hover:border-accent/35 hover:bg-surface-raised"
    >
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-muted">Up next</p>
        <p className="mt-1 font-semibold text-primary">{label}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <ArrowRight
        size={18}
        className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
        aria-hidden
      />
    </Link>
  );
}
