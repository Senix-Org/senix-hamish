import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Ban,
  CreditCard,
  GitBranch,
  GitPullRequest,
  Plug,
  Plus,
} from 'lucide-react';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { RecentAnalyses } from '@features/dashboard/components/recent-analyses';
import { RealtimeReviews } from '@features/dashboard/components/realtime-reviews';
import type { AnalysisCardData } from '@features/dashboard/components/analysis-card';
import {
  DashboardQuickLink,
  DashboardSection,
  DashboardStatCard,
  DashboardUsageMeter,
} from '@features/dashboard/components/dashboard-ui';
import { DashboardPageHeader } from '@features/dashboard/components/page-header';
import RepoToggle from '@features/dashboard/components/repo-toggle';
import { getGithubAppInstallUrl } from '@features/github-integration/install-url';
import { currentAppUserId } from '@features/auth/mcp-tokens';
import { getUserPlan } from '@features/billing/plan-limits';

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
  completed_at: string | null;
  error_message: string | null;
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
        'id, status, summary, risk_level, created_at, completed_at, error_message, ' +
          'github_comment_url, ' +
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

  let usage: { used: number; limit: number; percent: number; planLabel: string } | null = null;
  try {
    const userId = await currentAppUserId();
    if (userId) {
      const plan = await getUserPlan(userId);
      const limit = plan.effectiveLimit.tokens;
      if (limit > 0) {
        usage = {
          used: plan.tokensUsed,
          limit,
          percent: Math.min(100, Math.round((plan.tokensUsed / limit) * 100)),
          planLabel: plan.effectiveLimit.label,
        };
      }
    }
  } catch {
    usage = null;
  }

  const enabledRepoCount = repos.filter((r) => r.enabled).length;
  const nowMs = Date.now(); // eslint-disable-line react-hooks/purity
  const weeklyAnalysisCount = analyses.filter(
    (a) => nowMs - new Date(a.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
  ).length;
  const highRiskCount = analyses.filter((a) => a.risk_level === 'high').length;

  const analysisCards: AnalysisCardData[] = analyses.map((a) => ({
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

  return (
    <div>
      <DashboardPageHeader
        eyebrow="Overview"
        title="Your reviews at a glance"
        description={
          <>
            {enabledRepoCount} {enabledRepoCount === 1 ? 'repo' : 'repos'} connected ·{' '}
            {weeklyAnalysisCount} {weeklyAnalysisCount === 1 ? 'analysis' : 'analyses'} this week
          </>
        }
        action={
          <Link href="/dashboard/reviews" className="btn-senix btn-senix-secondary">
            <GitPullRequest size={15} strokeWidth={2} />
            All reviews
          </Link>
        }
      />

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

      <div className="mt-8 flex flex-col gap-4 lg:flex-row">
        {usage && (
          <div className="lg:flex-1">
            <DashboardUsageMeter
              used={usage.used}
              limit={usage.limit}
              planLabel={usage.planLabel}
            />
          </div>
        )}
        <div className={`flex flex-wrap gap-3 ${usage ? 'lg:flex-1' : 'w-full'}`}>
          <DashboardQuickLink
            href={installUrl}
            title="Connect repo"
            description="Install the GitHub App on a new repository"
            icon={GitBranch}
            external
          />
          <DashboardQuickLink
            href="/dashboard/connect"
            title="Connect IDE"
            description="Set up MCP in Cursor or Claude Code"
            icon={Plug}
          />
          <DashboardQuickLink
            href="/dashboard/billing"
            title="Billing"
            description="Manage plan and token limits"
            icon={CreditCard}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard label="Total reviews" value={analyses.length} icon={GitPullRequest} />
        <DashboardStatCard
          label="This week"
          value={weeklyAnalysisCount}
          icon={Activity}
          hint="Last 7 days"
        />
        <DashboardStatCard
          label="High risk"
          value={highRiskCount}
          icon={AlertTriangle}
          hint="In recent list"
        />
        <DashboardStatCard
          label="Repos active"
          value={enabledRepoCount}
          icon={GitBranch}
          hint={`${repos.length} connected`}
        />
      </div>

      <DashboardSection
        className="mt-10"
        title="Connected repositories"
        description="Toggle repos on or off without uninstalling the GitHub App."
        action={
          <a href={installUrl} className="btn-senix btn-senix-secondary">
            <Plus size={15} strokeWidth={2} />
            Connect repo
          </a>
        }
      >
        {repos.length === 0 ? (
          <ReposEmptyState installUrl={installUrl} />
        ) : (
          <div className="repo-list">
            {repos.map((repo) => (
              <div key={repo.id} className="repo-row">
                <span
                  className="repo-dot"
                  style={{
                    background: repoDotColor(repo.full_name),
                    color: repoDotColor(repo.full_name),
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm text-primary">
                    {repo.full_name}
                  </span>
                  <span className="text-xs text-muted">{repo.enabled ? 'Active' : 'Paused'}</span>
                </div>
                <RepoToggle repoId={repo.id} enabled={repo.enabled} />
              </div>
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        className="mt-10"
        title="Recent analyses"
        description="Latest reviews across your connected repositories."
        action={
          analyses.length > 0 ? (
            <Link
              href="/dashboard/reviews"
              className="text-sm text-accent hover:text-accent-hover"
            >
              View all
            </Link>
          ) : undefined
        }
      >
        {analyses.length === 0 ? <AnalysesEmptyState /> : <RecentAnalyses analyses={analysisCards} />}
      </DashboardSection>

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
      <span
        className="flex-1"
        title={`${usage.used.toLocaleString()} of ${usage.limit.toLocaleString()} tokens used`}
      >
        {blocked
          ? `You've used all your tokens for this month. Upgrade to continue getting reviews.`
          : `You've used ${usage.percent}% of your token budget this month.`}
      </span>
      <Link href="/dashboard/billing" className="btn-senix btn-senix-secondary shrink-0">
        Upgrade
      </Link>
    </div>
  );
}

function ReposEmptyState({ installUrl }: { installUrl: string }): React.ReactElement {
  return (
    <div className="repo-list">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-muted">
          <GitBranch size={22} strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-sm font-medium text-primary">No repos connected yet</p>
        <p className="mt-1 max-w-xs text-sm text-secondary">
          Connect your first repo to start getting automatic PR reviews.
        </p>
        <a href={installUrl} className="btn-senix btn-senix-primary mt-5">
          <Plus size={15} strokeWidth={2} />
          Connect a repo
        </a>
      </div>
    </div>
  );
}

function AnalysesEmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-surface-border bg-surface/50 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-muted">
        <GitPullRequest size={22} strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-primary">No reviews yet</p>
      <p className="mt-1 max-w-xs text-sm text-secondary">
        Open a pull request in a connected repo. Senix usually reviews within 20–40 seconds.
      </p>
    </div>
  );
}
