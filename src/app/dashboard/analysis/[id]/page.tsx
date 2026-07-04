import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { Reveal } from '@features/shared/components/reveal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Severity tone for the overall risk level and the detected-risk tags. */
const RISK_TONE: Record<string, string> = {
  low: 'text-risk-low bg-risk-low/10 border-risk-low/30',
  medium: 'text-risk-medium bg-risk-medium/10 border-risk-medium/30',
  high: 'text-risk-high bg-risk-high/10 border-risk-high/30',
  critical: 'text-risk-high bg-risk-high/20 border-risk-high/40',
};

const CHANGE_COLOR: Record<string, string> = {
  added: 'text-risk-low',
  removed: 'text-risk-high',
  modified: 'text-risk-medium',
};

type FocusArea = { file: string; lines: string; reason: string };

type StructuralChange = { change: string; kind: string; id: string; name?: string };

type StructuralFile = {
  filename: string;
  language: string;
  supported?: boolean;
  summary: { added: number; removed: number; modified: number; unchanged: number };
  changes: StructuralChange[];
};

type RiskFlags = {
  file_count?: number;
  supported_file_count?: number;
  symbol_changes?: number;
  detected_risks?: string[];
  structural_diff?: StructuralFile[];
};

type AnalysisDetail = {
  id: string;
  status: string;
  commit_sha: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  summary: string | null;
  risk_level: string | null;
  focus_areas: FocusArea[] | null;
  risk_flags: RiskFlags | null;
  tokens_used: number | null;
  cost_usd_cents: number | null;
  github_comment_url: string | null;
  pull_requests: {
    github_pr_number: number;
    title: string;
    author_login: string | null;
    head_sha: string | null;
    repositories: { full_name: string } | null;
  } | null;
};

/**
 * Detail view for a single analysis, laid out as a review report: a
 * breadcrumb, a header card, then cards for the behavioral summary,
 * detected risks, reviewer focus, and the structural diff. RLS scopes the
 * row to the signed-in user, so `notFound()` covers both "no such id" and
 * "not yours".
 */
export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = (await supabase
    .from('analyses')
    .select(
      'id, status, commit_sha, created_at, completed_at, error_message, summary, risk_level, ' +
        'focus_areas, risk_flags, tokens_used, cost_usd_cents, github_comment_url, ' +
        'pull_requests(github_pr_number, title, author_login, head_sha, repositories(full_name))'
    )
    .eq('id', id)
    .maybeSingle()) as unknown as { data: AnalysisDetail | null };

  if (!data) {
    notFound();
  }

  const pr = data.pull_requests;
  const repoName = pr?.repositories?.full_name ?? 'unknown';
  const prNumber = pr?.github_pr_number;
  const flags = data.risk_flags ?? {};
  const detectedRisks = flags.detected_risks ?? [];
  const focusAreas = data.focus_areas ?? [];
  const structural = flags.structural_diff ?? [];
  // A run still marked `running` with no completion long after it started is
  // treated as failed, so this page never shows an endless spinner for jobs
  // that died before a status could be recorded.
  // Server Component rendered once per request, so reading the clock here is
  // deterministic for this render (same pattern as the dashboard overview).
  const nowMs = Date.now(); // eslint-disable-line react-hooks/purity
  const stale =
    data.status === 'running' &&
    !data.completed_at &&
    nowMs - new Date(data.created_at).getTime() > 10 * 60 * 1000;
  const failed = data.status === 'failed' || stale;
  const riskTone =
    (data.risk_level && RISK_TONE[data.risk_level]) ??
    'text-muted bg-surface-raised border-surface-border';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Reveal>
        <nav className="flex items-center gap-1.5 text-sm text-muted">
          <Link href="/dashboard/reviews" className="transition-colors hover:text-primary">
            Reviews
          </Link>
          <ChevronRight size={14} className="text-surface-border" />
          <span className="text-secondary">
            {prNumber !== undefined ? `PR #${prNumber}` : 'Review'}
          </span>
        </nav>
      </Reveal>

      {/* Header card */}
      <Reveal delay={0.04}>
        <header className="rounded-xl border border-surface-border bg-surface p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-sm text-secondary">
                <span className="text-primary">{repoName}</span>
                {prNumber !== undefined && <span className="text-muted">#{prNumber}</span>}
                {pr?.author_login && <span className="text-muted">· by {pr.author_login}</span>}
                <span className="text-muted" suppressHydrationWarning>
                  · {new Date(data.created_at).toLocaleDateString()}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold leading-snug tracking-[-0.01em] text-primary">
                {pr?.title ?? '(untitled PR)'}
              </h1>
            </div>

            {data.github_comment_url && (
              <a
                href={data.github_comment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-senix btn-senix-secondary shrink-0 self-start"
              >
                View on GitHub
                <ArrowUpRight size={14} />
              </a>
            )}
          </div>

          {/* Status row */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-surface-border pt-4">
            <StatusPill status={failed ? 'failed' : data.status} label={failed ? 'Review Failed' : undefined} />
            {data.risk_level && (
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${riskTone}`}
              >
                Risk: {data.risk_level}
              </span>
            )}
            {data.commit_sha && (
              <span className="font-mono text-xs text-muted">{data.commit_sha.slice(0, 7)}</span>
            )}
            <span className="ml-auto font-mono text-[11px] text-muted">{data.id}</span>
          </div>
        </header>
      </Reveal>

      {/* Failed notice */}
      {failed && (
        <Reveal delay={0.06}>
          <section className="rounded-xl border border-risk-high/30 bg-risk-high/10 p-6">
            <h2 className="text-sm font-semibold text-risk-high">Review failed</h2>
            <p className="mt-1 text-sm leading-relaxed text-secondary">
              {data.error_message ??
                'This review did not complete. Open a new commit on the pull request to retry.'}
            </p>
          </section>
        </Reveal>
      )}

      {/* Behavioral summary */}
      {data.summary && (
        <Reveal delay={0.08}>
          <Card>
            <SectionLabel>Behavioral summary</SectionLabel>
            <p className="text-[15px] leading-relaxed text-primary">{data.summary}</p>
          </Card>
        </Reveal>
      )}

      {/* Detected risks */}
      {detectedRisks.length > 0 && (
        <Reveal delay={0.1}>
          <Card>
            <SectionLabel>Detected risks</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {detectedRisks.map((r, i) => (
                <span
                  key={i}
                  className={`rounded-md border px-2 py-1 font-mono text-xs ${riskTone}`}
                >
                  {r}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      {/* Reviewer focus */}
      {focusAreas.length > 0 && (
        <Reveal delay={0.12}>
          <Card padded={false}>
            <div className="p-6 pb-3">
              <SectionLabel className="mb-0">Reviewer should focus on</SectionLabel>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-surface-raised text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-6 py-2.5 text-left font-medium">File</th>
                    <th className="w-24 px-4 py-2.5 text-left font-medium">Lines</th>
                    <th className="px-4 py-2.5 text-left font-medium">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {focusAreas.map((f, i) => (
                    <tr key={i} className="transition-colors hover:bg-surface-raised/40">
                      <td className="px-6 py-3 font-mono text-xs text-primary">{f.file}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{f.lines}</td>
                      <td className="px-4 py-3 leading-relaxed text-secondary">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      )}

      {/* Structural diff */}
      {structural.length > 0 && (
        <Reveal delay={0.14}>
          <section>
            <SectionLabel>Structural diff</SectionLabel>
            <div className="space-y-2">
              {structural.map((f, i) => (
                <StructuralFileBlock key={i} file={f} />
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Footer metadata */}
      <Reveal delay={0.16}>
        <section className="flex flex-wrap gap-x-5 gap-y-2 border-t border-surface-border pt-5 font-mono text-xs text-muted">
          {data.tokens_used !== null && <span>{data.tokens_used.toLocaleString()} tokens</span>}
          {data.cost_usd_cents !== null && <span>${(data.cost_usd_cents / 100).toFixed(4)}</span>}
          {flags.file_count !== undefined && <span>{flags.file_count} files analyzed</span>}
          {flags.symbol_changes !== undefined && (
            <span>{flags.symbol_changes} symbol changes</span>
          )}
          {data.completed_at && (
            <span suppressHydrationWarning>
              completed {new Date(data.completed_at).toLocaleString()}
            </span>
          )}
        </section>
      </Reveal>
    </div>
  );
}

function Card({
  children,
  padded = true,
}: {
  children: React.ReactNode;
  padded?: boolean;
}): React.ReactElement {
  return (
    <section
      className={`rounded-xl border border-surface-border bg-surface ${padded ? 'p-6' : ''}`}
    >
      {children}
    </section>
  );
}

function SectionLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <h2 className={`mb-3 text-sm font-semibold text-primary ${className}`}>{children}</h2>
  );
}

function StatusPill({ status, label }: { status: string; label?: string }): React.ReactElement {
  const tone =
    status === 'completed'
      ? 'text-risk-low bg-risk-low/10 border-risk-low/30'
      : status === 'failed'
        ? 'text-risk-high bg-risk-high/10 border-risk-high/30'
        : status === 'running'
          ? 'text-accent bg-accent/10 border-accent/30'
          : 'text-secondary bg-surface-raised border-surface-border';
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {label ?? status}
    </span>
  );
}

function StructuralFileBlock({ file }: { file: StructuralFile }): React.ReactElement {
  const meaningfulChanges = file.changes.filter((c) => c.change !== 'unchanged');

  return (
    <details className="group rounded-xl border border-surface-border bg-surface transition-colors hover:border-neutral-border">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="truncate font-mono text-primary">{file.filename}</span>
        <span className="font-mono text-xs text-muted">({file.language})</span>
        <span className="ml-auto shrink-0 font-mono text-xs tabular-nums">
          <span className="text-risk-low">+{file.summary.added}</span>{' '}
          <span className="text-risk-medium">~{file.summary.modified}</span>{' '}
          <span className="text-risk-high">-{file.summary.removed}</span>
        </span>
        <ChevronRight
          size={15}
          className="shrink-0 text-muted transition-transform group-open:rotate-90"
        />
      </summary>
      {meaningfulChanges.length > 0 && (
        <div className="space-y-1.5 border-t border-surface-border px-5 py-4 font-mono text-xs">
          {meaningfulChanges.map((c, j) => (
            <div key={j} className="flex items-baseline gap-3">
              <span className={`${CHANGE_COLOR[c.change] ?? 'text-muted'} w-20 shrink-0`}>
                {c.change}
              </span>
              <span className="w-16 shrink-0 text-muted">{c.kind}</span>
              <span className="truncate text-secondary">{c.name ?? c.id}</span>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
