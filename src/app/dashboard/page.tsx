import Link from 'next/link';
import { ArrowUpRight, GitBranch } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import RepoToggle from '@/components/repo-toggle';
import { Reveal, RevealItem, RevealStagger } from '@/components/reveal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RISK_BADGE: Record<string, string> = {
  low: 'text-green-400 bg-green-950/40 border-green-900/50',
  medium: 'text-yellow-400 bg-yellow-950/40 border-yellow-900/50',
  high: 'text-red-400 bg-red-950/40 border-red-900/50',
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
      .select('id, full_name, enabled, installations!inner(account_login, uninstalled_at)')
      .is('installations.uninstalled_at', null)
      .order('full_name', { ascending: true }),
  ]);

  const analyses = (analysesResult.data ?? []) as unknown as AnalysisRow[];
  const repos = (reposResult.data ?? []) as unknown as RepoRow[];

  const enabledRepoCount = repos.filter((r) => r.enabled).length;
  const weeklyAnalysisCount = analyses.filter(
    (a) => Date.now() - new Date(a.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="space-y-12">
      <Reveal>
        <section>
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
            Dashboard
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-[-0.02em]">
            Your reviews at a glance
          </h1>
          <p className="mt-3 text-zinc-400">
            <span className="text-zinc-200 tabular-nums">{enabledRepoCount}</span>{' '}
            {enabledRepoCount === 1 ? 'repo' : 'repos'} connected ·{' '}
            <span className="text-zinc-200 tabular-nums">{weeklyAnalysisCount}</span>{' '}
            {weeklyAnalysisCount === 1 ? 'analysis' : 'analyses'} this week
          </p>
        </section>
      </Reveal>

      <Reveal delay={0.05}>
        <section>
          <SectionHeading title="Recent analyses" />
          {analyses.length === 0 ? (
            <EmptyCard>
              No analyses yet. Open a PR in a connected repo and Senix will post a review summary
              within ~30 seconds. We&apos;ll show it here as soon as it&apos;s ready.
            </EmptyCard>
          ) : (
            <RevealStagger className="space-y-3" staggerMs={40}>
              {analyses.map((a) => (
                <RevealItem key={a.id}>
                  <AnalysisListItem analysis={a} />
                </RevealItem>
              ))}
            </RevealStagger>
          )}
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <section>
          <SectionHeading title="Connected repos" />
          {repos.length === 0 ? (
            <EmptyCard>
              No repos connected yet.{' '}
              <Link
                href="https://github.com/apps/senix-bot/installations/new"
                className="text-green-500 hover:text-green-400 transition-colors underline-offset-2 hover:underline"
              >
                Install the GitHub App →
              </Link>{' '}
              to get started. Pick the repos you want reviewed.
            </EmptyCard>
          ) : (
            <ul className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800 overflow-hidden">
              {repos.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-zinc-900/60 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <GitBranch
                      size={16}
                      strokeWidth={1.5}
                      className="mt-1 text-zinc-500 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-zinc-100 font-medium truncate">{r.full_name}</div>
                      {r.installations?.account_login && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {r.installations.account_login}
                        </div>
                      )}
                    </div>
                  </div>
                  <RepoToggle repoId={r.id} enabled={r.enabled} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
    </div>
  );
}

function SectionHeading({ title }: { title: string }): React.ReactElement {
  return (
    <h2 className="text-xl font-semibold tracking-tight text-zinc-100 mb-4">{title}</h2>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400 text-sm leading-relaxed">
      {children}
    </div>
  );
}

function AnalysisListItem({ analysis }: { analysis: AnalysisRow }): React.ReactElement {
  const repoName = analysis.pull_requests?.repositories?.full_name ?? 'unknown';
  const prNumber = analysis.pull_requests?.github_pr_number;
  const prTitle = analysis.pull_requests?.title ?? '(untitled PR)';
  const riskBadgeClass =
    (analysis.risk_level && RISK_BADGE[analysis.risk_level]) ??
    'text-zinc-400 bg-zinc-800 border-zinc-700';

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 hover:bg-zinc-900/60 transition-colors">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
            <span className="text-zinc-300 font-mono truncate">{repoName}</span>
            {prNumber !== undefined && (
              <span className="text-zinc-500 font-mono">#{prNumber}</span>
            )}
            <span className="text-zinc-700">·</span>
            <span>{new Date(analysis.created_at).toLocaleString()}</span>
          </div>
          <div className="text-zinc-100 font-medium mb-1.5 truncate">{prTitle}</div>
          {analysis.summary && (
            <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed">
              {analysis.summary}
            </p>
          )}
        </div>
        {analysis.risk_level && (
          <span
            className={`shrink-0 text-[10px] tracking-wider rounded-full px-2.5 py-1 font-bold uppercase border ${riskBadgeClass}`}
          >
            {analysis.risk_level}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link
          href={`/dashboard/analysis/${analysis.id}`}
          className="inline-flex items-center gap-1 text-zinc-300 hover:text-zinc-100 transition-colors"
        >
          Details
          <ArrowUpRight size={12} className="-mr-0.5" />
        </Link>
        {analysis.github_comment_url && (
          <a
            href={analysis.github_comment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-zinc-500 hover:text-green-400 transition-colors"
          >
            View on GitHub
            <ArrowUpRight size={12} />
          </a>
        )}
      </div>
    </li>
  );
}
