import Link from 'next/link';
import { GitPullRequest } from 'lucide-react';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { RecentAnalyses } from '@features/dashboard/components/recent-analyses';
import { RealtimeReviews } from '@features/dashboard/components/realtime-reviews';
import type { AnalysisCardData } from '@features/dashboard/components/analysis-card';
import { DashboardSection } from '@features/dashboard/components/dashboard-ui';
import { DashboardPageHeader } from '@features/dashboard/components/page-header';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AnalysisRow = {
  id: string;
  status: string;
  summary: string | null;
  risk_level: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  github_comment_url: string | null;
  pull_request_id: string;
  pull_requests: {
    id: string;
    github_pr_number: number;
    title: string;
    repositories: {
      full_name: string;
    } | null;
  } | null;
};

export default async function ReviewsPage(): Promise<React.ReactElement> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('analyses')
    .select(
      'id, status, summary, risk_level, created_at, completed_at, error_message, ' +
        'github_comment_url, pull_request_id, ' +
        'pull_requests(id, github_pr_number, title, repositories(full_name))'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  const analyses = (data ?? []) as unknown as AnalysisRow[];

  // A single PR can have multiple analyses (opened, synchronize, reopened).
  // The reviews list shows the latest analysis for each PR so the user sees
  // one row per pull request, not one row per webhook action.
  const latestByPr = new Map<string, AnalysisRow>();
  for (const a of analyses) {
    const prId = a.pull_request_id;
    if (!prId) continue;
    const existing = latestByPr.get(prId);
    if (!existing || new Date(a.created_at).getTime() > new Date(existing.created_at).getTime()) {
      latestByPr.set(prId, a);
    }
  }
  const dedupedAnalyses = Array.from(latestByPr.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const cards: AnalysisCardData[] = dedupedAnalyses.map((a) => ({
    id: a.id,
    summary: a.summary,
    risk_level: a.risk_level,
    status: a.status,
    created_at: a.created_at,
    completed_at: a.completed_at,
    error_message: a.error_message,
    github_comment_url: a.github_comment_url,
    pr_title: a.pull_requests?.title ?? '(untitled PR)',
    pr_number: a.pull_requests?.github_pr_number ?? null,
    repo_name: a.pull_requests?.repositories?.full_name ?? 'unknown',
  }));

  const highCount = cards.filter((c) => c.risk_level === 'high').length;

  return (
    <div>
      <DashboardPageHeader
        eyebrow="Reviews"
        title="All reviews"
        description={
          <>
            {cards.length} total · {highCount} high risk. Filter and sort below.
          </>
        }
        action={
          <Link href="/dashboard" className="btn-senix btn-senix-ghost text-sm">
            Back to overview
          </Link>
        }
      />

      <DashboardSection className="mt-8" title="Review history" description="Newest first.">
        {cards.length === 0 ? <ReviewsEmptyState /> : <RecentAnalyses analyses={cards} />}
      </DashboardSection>

      <RealtimeReviews />
    </div>
  );
}

function ReviewsEmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-surface-border bg-surface/50 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-muted">
        <GitPullRequest size={22} strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-primary">No reviews yet</p>
      <p className="mt-1 max-w-xs text-sm text-secondary">
        Open a pull request on a connected repo. Senix usually reviews within 20–40 seconds.
      </p>
      <Link href="/dashboard" className="btn-senix btn-senix-secondary mt-5">
        View connected repos
      </Link>
    </div>
  );
}
