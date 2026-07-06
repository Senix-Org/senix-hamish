import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatRelativeTime } from '@features/shared/relative-time';
import { GithubMark } from './github-mark';

const RISK_BADGE: Record<string, string> = {
  low: 'text-risk-low bg-risk-low/10',
  medium: 'text-risk-medium bg-risk-medium/10',
  high: 'text-risk-high bg-risk-high/10',
  critical: 'text-risk-high bg-risk-high/20',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'text-secondary bg-surface-raised' },
  running: { label: 'Running', className: 'text-accent bg-accent/10' },
  completed: { label: 'Complete', className: 'text-risk-low bg-risk-low/10' },
  failed: { label: 'Failed', className: 'text-risk-high bg-risk-high/10' },
};

const FAILED_BADGE = { label: 'Review Failed', className: 'text-risk-high bg-risk-high/10' };

// A review still marked `running` or `queued` with no completion this long
// after it was created is treated as failed. This catches rows that died
// before a status could be recorded (the analyze-pr function used to be
// killed at 60s) and rows stuck at `queued` behind a stale ownership claim,
// so neither leaves a permanent spinner.
const STALE_AFTER_MS = 10 * 60 * 1000;

export type AnalysisCardData = {
  id: string;
  summary: string | null;
  risk_level: string | null;
  status: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  github_comment_url: string | null;
  pr_title: string;
  pr_number: number | null;
  repo_name: string;
};

/**
 * A single review card. The entire card is the click target: a stretched
 * `<Link>` overlay fills the card and navigates to the analysis detail
 * page, while the optional "View on GitHub" link floats above it (higher
 * z-index, its own pointer events) so it stays independently clickable.
 * This keeps the markup valid (no anchor nested in an anchor).
 */
export function AnalysisCard({ analysis }: { analysis: AnalysisCardData }): React.ReactElement {
  const summary = analysis.summary ?? '';
  const riskLabel = analysis.risk_level ? analysis.risk_level : 'unknown';
  const riskBadgeClass =
    (analysis.risk_level && RISK_BADGE[analysis.risk_level]) ?? 'text-muted bg-surface-raised';
  const created = new Date(analysis.created_at);
  // Reading the clock to detect a stuck-running row. The card re-renders on
  // Realtime updates and router refreshes, so any drift self-corrects; the
  // status/error text is marked suppressHydrationWarning to absorb the rare
  // server/client boundary crossing.
  const now = Date.now(); // eslint-disable-line react-hooks/purity
  const stale =
    (analysis.status === 'running' || analysis.status === 'queued') &&
    !analysis.completed_at &&
    now - created.getTime() > STALE_AFTER_MS;
  const failed = analysis.status === 'failed' || stale;
  const status = failed
    ? FAILED_BADGE
    : analysis.status
      ? STATUS_BADGE[analysis.status]
      : undefined;

  return (
    <div className="group relative rounded-xl border border-surface-border bg-surface p-6 transition-all duration-150 hover:border-neutral-border hover:bg-surface-raised">
      {/* Stretched click target covering the whole card. */}
      <Link
        href={`/dashboard/analysis/${analysis.id}`}
        aria-label={`Open review for ${analysis.pr_title}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />

      <div className="pointer-events-none relative z-10">
        <div className="absolute right-0 top-0 flex items-center gap-2">
          {status && (
            <span
              suppressHydrationWarning
              className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wider ${status.className}`}
            >
              {status.label}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wider ${riskBadgeClass}`}
          >
            {riskLabel}
          </span>
        </div>

        <div className="pr-36">
          <div className="flex items-center gap-2 text-sm text-secondary">
            <span className="truncate font-mono">{analysis.repo_name}</span>
            {analysis.pr_number !== null && (
              <span className="text-muted">#{analysis.pr_number}</span>
            )}
          </div>
          <h3 className="mt-1 text-base font-semibold leading-snug text-primary">
            {analysis.pr_title}
          </h3>
        </div>

        {failed ? (
          <p
            suppressHydrationWarning
            className="mt-2 line-clamp-2 text-sm leading-relaxed text-risk-high"
          >
            {analysis.error_message ?? 'This review did not complete. Please try again.'}
          </p>
        ) : (
          summary && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-secondary">{summary}</p>
          )
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted" title={created.toISOString()} suppressHydrationWarning>
            {formatRelativeTime(created)}
          </span>
          <div className="flex items-center gap-2">
            {analysis.github_comment_url && (
              <a
                href={analysis.github_comment_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto relative z-20 inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-2 py-1.5 text-sm text-secondary transition-colors duration-150 hover:text-primary"
              >
                <GithubMark size={13} />
                View on GitHub
              </a>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-muted transition-colors duration-150 group-hover:text-primary">
              View details
              <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
