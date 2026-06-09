import Link from 'next/link';
import { GitPullRequest, Plus, AlertTriangle, Ban } from 'lucide-react';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { RecentAnalyses } from '@features/dashboard/components/recent-analyses';
import { RealtimeReviews } from '@features/dashboard/components/realtime-reviews';
import type { AnalysisCardData } from '@features/dashboard/components/analysis-card';
import RepoToggle from '@features/dashboard/components/repo-toggle';
import { getGithubAppInstallUrl } from '@features/github-integration/install-url';
import { currentAppUserId } from '@features/auth/mcp-tokens';
import { getUserPlan } from '@features/billing/plan-limits';

/**
 * Deterministic accent dot per repo so the list reads at a glance without
 * needing real language data. Stable for a given name across renders.
 */
const REPO_DOT_COLORS = ['#3ecf8e', '#76a7d6', '#e0a23a', '#c98bdb', '#f0616a', '#5fc9b8'];
function repoDotColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return REPO_DOT_COLORS[hash % REPO_DOT_COLORS.length];
}

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

type RepoRow = {
  id: string;
  full_name: string;
  enabled: boolean;
};

/**
 * Customer dashboard overview. Reads the signed-in user's recent
 * analyses and connected repos through the user-context Supabase client
 * (so RLS enforces ownership). The /dashboard layout has already bounced
 * any unauthenticated visitor to /login by the time we get here.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ setup?: string }>;
} = {}): Promise<React.ReactElement> {
  const params = (await searchParams) ?? {};
  const setupIncomplete = params.setup === 'missing';
  const installUrl = getGithubAppInstallUrl();
  const supabase = await createServerSupabaseClient();

  const [analysesResult, reposResult] = await Promise.all([
    supabase
      .from('analyses')
      .select(
        'id, status, summary, risk_level, created_at, github_comment_url, ' +
          'pull_requests(github_pr_number, title, repositories(full_name))'
      )
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('repositories')
      .select('id, full_name, enabled, installations!inner(account_login, uninstalled_at)')
      .is('installations.uninstalled_at', null)
      .order('full_name', { ascending: true }),
  ]);

  const analyses = (analysesResult.data ?? []) as unknown as AnalysisRow[];
  const repos = (reposResult.data ?? []) as unknown as RepoRow[];

  // Plan usage for the limit banner. Non-fatal: if the plan can't be read
  // (e.g. brand-new account before its users row settles) we just skip it.
  let usage: { used: number; limit: number; percent: number } | null = null;
  try {
    const userId = await currentAppUserId();
    if (userId) {
      const plan = await getUserPlan(userId);
      const limit = plan.effectiveLimit.reviews;
      if (limit > 0) {
        usage = {
          used: plan.reviewsUsed,
          limit,
          percent: Math.min(100, Math.round((plan.reviewsUsed / limit) * 100)),
        };
      }
    }
  } catch {
    usage = null;
  }

  const enabledRepoCount = repos.filter((r) => r.enabled).length;
  // Server Component: rendered once per request, so reading the clock here
  // is deterministic for this render. Hoisted out of the filter for clarity.
  const nowMs = Date.now(); // eslint-disable-line react-hooks/purity
  const weeklyAnalysisCount = analyses.filter(
    (a) => nowMs - new Date(a.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
  ).length;

  const analysisCards: AnalysisCardData[] = analyses.map((a) => ({
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
      <header>
        <h1 className="text-3xl font-semibold text-primary">Your reviews at a glance</h1>
        <p className="mt-2 text-sm text-secondary">
          {enabledRepoCount} {enabledRepoCount === 1 ? 'repo' : 'repos'} connected,{' '}
          {weeklyAnalysisCount} {weeklyAnalysisCount === 1 ? 'analysis' : 'analyses'} this
          week
        </p>
      </header>

      {usage && usage.percent >= 80 && <UsageLimitBanner usage={usage} />}

      {setupIncomplete && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-risk-medium/30 bg-risk-medium/10 px-4 py-3 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0 text-risk-medium" />
          <span className="flex-1">
            We couldn&apos;t complete that connection. Install Senix on GitHub to connect a
            repository.
          </span>
          <a href={installUrl} className="btn-senix btn-senix-secondary shrink-0">
            <Plus size={15} strokeWidth={2} />
            Connect
          </a>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total reviews" value={analyses.length} />
        <StatCard label="This week" value={weeklyAnalysisCount} />
        <StatCard label="Repos connected" value={enabledRepoCount} />
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Connected repositories</h2>
          <a href={installUrl} className="btn-senix btn-senix-secondary">
            <Plus size={15} strokeWidth={2} />
            Add repository
          </a>
        </div>
        {repos.length === 0 ? (
          <ReposEmptyState installUrl={installUrl} />
        ) : (
          <div className="repo-list">
            {repos.map((repo) => (
              <div key={repo.id} className="repo-row">
                <span
                  className="repo-dot"
                  style={{ background: repoDotColor(repo.full_name), color: repoDotColor(repo.full_name) }}
                  aria-hidden
                />
                <span className="truncate font-mono text-sm text-primary">{repo.full_name}</span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted">{repo.enabled ? 'Active' : 'Paused'}</span>
                  <RepoToggle repoId={repo.id} enabled={repo.enabled} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-primary">Recent analyses</h2>
        {analyses.length === 0 ? <AnalysesEmptyState /> : <RecentAnalyses analyses={analysisCards} />}
      </section>

      <RealtimeReviews />
    </div>
  );
}

function UsageLimitBanner({
  usage,
}: {
  usage: { used: number; limit: number; percent: number };
}): React.ReactElement {
  const blocked = usage.percent >= 100;
  return (
    <div
      className={`mt-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
        blocked
          ? 'border-risk-high/40 bg-risk-high/10 text-primary'
          : 'border-risk-medium/30 bg-risk-medium/10 text-primary'
      }`}
    >
      {blocked ? (
        <Ban size={16} className="shrink-0 text-risk-high" />
      ) : (
        <AlertTriangle size={16} className="shrink-0 text-risk-medium" />
      )}
      <span className="flex-1">
        {blocked
          ? `You've reached your monthly review limit (${usage.used} of ${usage.limit}). New pull requests won't be reviewed until your quota resets or you upgrade.`
          : `You've used ${usage.percent}% of your monthly reviews (${usage.used} of ${usage.limit}).`}
      </span>
      <Link href="/dashboard/billing" className="btn-senix btn-senix-secondary shrink-0">
        Upgrade
      </Link>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-6">
      <div className="text-2xl font-bold tabular-nums text-primary">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-secondary">{label}</div>
    </div>
  );
}

function ReposEmptyState({ installUrl }: { installUrl: string }): React.ReactElement {
  return (
    <div className="repo-list">
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <p className="text-sm font-medium text-primary">No repositories connected</p>
        <p className="mt-1 max-w-xs text-sm text-secondary">
          Connect a repo and Senix reviews every pull request automatically.
        </p>
        <a href={installUrl} className="btn-senix btn-senix-primary mt-5">
          <Plus size={15} strokeWidth={2} />
          Connect a repository
        </a>
      </div>
    </div>
  );
}

function AnalysesEmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <GitPullRequest size={32} strokeWidth={1.5} className="text-muted" />
      <p className="mt-4 text-sm font-medium text-primary">No reviews yet</p>
      <p className="mt-1 max-w-xs text-sm text-secondary">
        Open a pull request in a connected repo and Senix will review it within 30 seconds.
      </p>
    </div>
  );
}
