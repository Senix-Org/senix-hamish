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

const RISK_STRIP: Record<string, string> = {
  low: '#3ecf8e',
  medium: '#e0a23a',
  high: '#f0616a',
  critical: '#f0616a',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'text-secondary bg-surface-raised' },
  running: { label: 'Running', className: 'text-accent bg-accent/10' },
  completed: { label: 'Complete', className: 'text-risk-low bg-risk-low/10' },
  failed: { label: 'Failed', className: 'text-risk-high bg-risk-high/10' },
};

const FAILED_BADGE = { label: 'Review Failed', className: 'text-risk-high bg-risk-high/10' };

const STALE_AFTER_MS = 10 * 60 * 1000;

/** A completed row with no risk level and an error is a soft failure (LLM
 *  or comment step failed) rather than a successful review. Show it as failed. */
function isSoftFailure(analysis: AnalysisCardData): boolean {
  return (
    analysis.status === 'completed' &&
    !analysis.risk_level &&
    Boolean(analysis.error_message)
  );
}

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

export function AnalysisCard({ analysis }: { analysis: AnalysisCardData }): React.ReactElement {
  const summary = analysis.summary ?? '';
  const softFailed = isSoftFailure(analysis);
  const riskLabel = analysis.risk_level ? analysis.risk_level : softFailed ? 'N/A' : 'unknown';
  const riskBadgeClass =
    (analysis.risk_level && RISK_BADGE[analysis.risk_level]) ?? 'text-muted bg-surface-raised';
  const stripColor = analysis.risk_level ? RISK_STRIP[analysis.risk_level] : null;
  const created = new Date(analysis.created_at);
  const now = Date.now(); // eslint-disable-line react-hooks/purity
  const stale =
    (analysis.status === 'running' || analysis.status === 'queued') &&
    !analysis.completed_at &&
    now - created.getTime() > STALE_AFTER_MS;
  const failed = analysis.status === 'failed' || stale || softFailed;
  const status = failed
    ? FAILED_BADGE
    : analysis.status
      ? STATUS_BADGE[analysis.status]
      : undefined;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-surface-border bg-surface shadow-sm transition-all duration-150 hover:border-neutral-border hover:bg-surface-raised hover:shadow-md hover:shadow-black/20">
      {stripColor && (
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: stripColor }}
          aria-hidden
        />
      )}

      <Link
        href={`/dashboard/analysis/${analysis.id}`}
        aria-label={`Open review for ${analysis.pr_title}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />

      <div className="pointer-events-none relative z-10 p-5 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-secondary">
              <span className="truncate font-mono">{analysis.repo_name}</span>
              {analysis.pr_number !== null && (
                <span className="shrink-0 text-muted">#{analysis.pr_number}</span>
              )}
            </div>
            <h3 className="mt-1 text-sm font-semibold leading-snug text-primary">
              {analysis.pr_title}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {status && (failed || analysis.status !== 'completed') && (
              <span
                suppressHydrationWarning
                className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${status.className}`}
              >
                {status.label}
              </span>
            )}
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${riskBadgeClass}`}
            >
              {riskLabel}
            </span>
          </div>
        </div>

        {failed ? (
          <p
            suppressHydrationWarning
            className="mt-2 line-clamp-2 text-xs leading-relaxed text-risk-high"
          >
            {analysis.error_message ?? 'This review did not complete. Please try again.'}
          </p>
        ) : (
          summary && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-secondary">{summary}</p>
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
                className="pointer-events-auto relative z-20 inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-2 py-1 text-xs text-secondary transition-colors duration-150 hover:text-primary"
              >
                <GithubMark size={12} />
                View on GitHub
              </a>
            )}
            <span className="inline-flex items-center gap-0.5 text-xs text-muted transition-colors duration-150 group-hover:text-primary">
              View details
              <ChevronRight size={13} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
