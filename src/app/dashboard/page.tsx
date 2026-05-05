import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import RepoToggle from '@/components/repo-toggle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RISK_BADGE: Record<string, string> = {
  low: 'text-green-400 bg-green-950/50',
  medium: 'text-yellow-400 bg-yellow-950/50',
  high: 'text-red-400 bg-red-950/50',
};

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
  installations: { account_login: string } | null;
};

/**
 * Customer dashboard. Reads the signed-in user's recent analyses and
 * connected repos through the user-context Supabase client (so RLS
 * enforces ownership). The /dashboard layout has already bounced any
 * unauthenticated visitor to /login by the time we get here.
 */
export default async function DashboardPage(): Promise<React.ReactElement> {
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
      .select('id, full_name, enabled, installations(account_login)')
      .order('full_name', { ascending: true }),
  ]);

  const analyses = (analysesResult.data ?? []) as unknown as AnalysisRow[];
  const repos = (reposResult.data ?? []) as unknown as RepoRow[];

  const enabledRepoCount = repos.filter((r) => r.enabled).length;
  const weeklyAnalysisCount = analyses.filter(
    (a) => Date.now() - new Date(a.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-zinc-400">
          {enabledRepoCount} {enabledRepoCount === 1 ? 'repo' : 'repos'} connected ·{' '}
          {weeklyAnalysisCount} {weeklyAnalysisCount === 1 ? 'analysis' : 'analyses'} this week
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Recent analyses</h2>
        {analyses.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400 text-sm">
            No analyses yet. Open a PR in a connected repo and we&apos;ll post a
            review summary within seconds.
          </div>
        ) : (
          <ul className="space-y-3">
            {analyses.map((a) => (
              <AnalysisListItem key={a.id} analysis={a} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Connected repos</h2>
        {repos.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400 text-sm">
            No repos connected yet.{' '}
            <Link
              href="https://github.com/apps/senix-bot"
              className="text-blue-400 hover:underline"
            >
              Install the GitHub App →
            </Link>
          </div>
        ) : (
          <ul className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800">
            {repos.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-zinc-100">{r.full_name}</div>
                  {r.installations?.account_login && (
                    <div className="text-xs text-zinc-500">{r.installations.account_login}</div>
                  )}
                </div>
                <RepoToggle repoId={r.id} enabled={r.enabled} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AnalysisListItem({ analysis }: { analysis: AnalysisRow }): React.ReactElement {
  const repoName = analysis.pull_requests?.repositories?.full_name ?? 'unknown';
  const prNumber = analysis.pull_requests?.github_pr_number;
  const prTitle = analysis.pull_requests?.title ?? '(untitled PR)';
  const riskBadgeClass =
    (analysis.risk_level && RISK_BADGE[analysis.risk_level]) ?? 'text-zinc-400 bg-zinc-800';

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        <span className="text-zinc-300">{repoName}</span>
        {prNumber !== undefined && <span>#{prNumber}</span>}
        <span>·</span>
        <span>{new Date(analysis.created_at).toLocaleString()}</span>
        {analysis.risk_level && (
          <span
            className={`ml-auto text-xs rounded px-2 py-0.5 font-bold uppercase ${riskBadgeClass}`}
          >
            {analysis.risk_level}
          </span>
        )}
      </div>
      <div className="text-zinc-100 font-medium mb-1 truncate">{prTitle}</div>
      {analysis.summary && (
        <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{analysis.summary}</p>
      )}
      <div className="flex gap-4 text-xs">
        {analysis.github_comment_url && (
          <a
            href={analysis.github_comment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            View on GitHub →
          </a>
        )}
        <Link
          href={`/dashboard/analysis/${analysis.id}`}
          className="text-zinc-400 hover:text-zinc-200"
        >
          Details →
        </Link>
      </div>
    </li>
  );
}
