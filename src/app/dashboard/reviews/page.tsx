import { GitPullRequest, AlertTriangle } from 'lucide-react';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { RecentAnalyses } from '@features/dashboard/components/recent-analyses';
import { RealtimeReviews } from '@features/dashboard/components/realtime-reviews';
import type { AnalysisCardData } from '@features/dashboard/components/analysis-card';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AnalysisRow = {
  id: string;
  status: string;
  summary: string | null;
  risk_level: string | null;
  created_at: string;
  github_comment_url: string | null;
  pull_requests: {
    github_pr_number: number;
    title: string;
    repositories: {
      full_name: string;
    } | null;
  } | null;
};

/**
 * Reviews page. Lists every review Senix has posted for the signed-in
 * user, newest first, using the same card and filter UI as the overview.
 * RLS scopes the query to the user's own analyses. Realtime keeps the
 * list fresh as new reviews land.
 */
export default async function ReviewsPage(): Promise<React.ReactElement> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('analyses')
    .select(
      'id, status, summary, risk_level, created_at, github_comment_url, ' +
        'pull_requests(github_pr_number, title, repositories(full_name))'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const header = (
    <header>
      <h1 className="text-3xl font-semibold text-primary">Reviews</h1>
      <p className="mt-2 text-sm text-secondary">
        Every review Senix has posted, newest first.
      </p>
    </header>
  );

  if (error) {
    return (
      <div>
        {header}
        <ReviewsErrorState message={error.message} />
      </div>
    );
  }

  const analyses = (data ?? []) as unknown as AnalysisRow[];
  const cards: AnalysisCardData[] = analyses.map((a) => ({
    id: a.id,
    summary: a.summary,
    risk_level: a.risk_level,
    status: a.status,
    created_at: a.created_at,
    github_comment_url: a.github_comment_url,
    pr_title: a.pull_requests?.title ?? '(untitled PR)',
    pr_number: a.pull_requests?.github_pr_number ?? null,
    repo_name: a.pull_requests?.repositories?.full_name ?? 'unknown',
  }));

  return (
    <div>
      {header}
      <section className="mt-8">
        {cards.length === 0 ? <ReviewsEmptyState /> : <RecentAnalyses analyses={cards} />}
      </section>
      <RealtimeReviews />
    </div>
  );
}

function ReviewsEmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center rounded-xl border border-surface-border bg-surface py-16 text-center">
      <GitPullRequest size={32} strokeWidth={1.5} className="text-muted" />
      <p className="mt-4 text-sm font-medium text-primary">No reviews yet</p>
      <p className="mt-1 max-w-xs text-sm text-secondary">
        Open a pull request in a connected repo and Senix will review it within 30 seconds. It
        will show up here automatically.
      </p>
    </div>
  );
}

function ReviewsErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="mt-8 flex flex-col items-center rounded-xl border border-risk-high/30 bg-risk-high/5 py-16 text-center">
      <AlertTriangle size={32} strokeWidth={1.5} className="text-risk-high" />
      <p className="mt-4 text-sm font-medium text-primary">Could not load your reviews</p>
      <p className="mt-1 max-w-sm text-sm text-secondary">{message}</p>
    </div>
  );
}
