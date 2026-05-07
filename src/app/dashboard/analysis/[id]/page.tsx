import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Reveal } from '@/components/reveal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RISK_BADGE: Record<string, string> = {
  low: 'text-green-400 bg-green-950/40 border-green-900/50',
  medium: 'text-yellow-400 bg-yellow-950/40 border-yellow-900/50',
  high: 'text-red-400 bg-red-950/40 border-red-900/50',
};

const CHANGE_COLOR: Record<string, string> = {
  added: 'text-green-400',
  removed: 'text-red-400',
  modified: 'text-yellow-400',
};

type FocusArea = {
  file: string;
  lines: string;
  reason: string;
};

type StructuralChange = {
  change: string;
  kind: string;
  id: string;
  name?: string;
};

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
 * Detail view for a single analysis. RLS scopes the row to the
 * signed-in user — `notFound()` covers both "no such id" and "you
 * don't own this".
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
      'id, status, commit_sha, created_at, completed_at, summary, risk_level, ' +
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
  const flags = data.risk_flags ?? {};
  const detectedRisks = flags.detected_risks ?? [];
  const focusAreas = data.focus_areas ?? [];
  const structural = flags.structural_diff ?? [];
  const riskBadgeClass =
    (data.risk_level && RISK_BADGE[data.risk_level]) ??
    'text-zinc-400 bg-zinc-800 border-zinc-700';

  return (
    <div className="space-y-10">
      <Reveal>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>
      </Reveal>

      <Reveal delay={0.05}>
        <header className="space-y-3">
          <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-2 font-mono">
            <span className="text-zinc-300">{repoName}</span>
            {pr?.github_pr_number !== undefined && (
              <span className="text-zinc-500">#{pr.github_pr_number}</span>
            )}
            {pr?.author_login && <span className="text-zinc-500">· by {pr.author_login}</span>}
            <span className="text-zinc-500">
              · {new Date(data.created_at).toLocaleString()}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-100">
            {pr?.title ?? '(untitled PR)'}
          </h1>
          <div className="flex items-center gap-3 text-xs">
            {data.commit_sha && (
              <span className="font-mono text-zinc-500">{data.commit_sha.slice(0, 7)}</span>
            )}
            <StatusPill status={data.status} />
            {data.risk_level && (
              <span
                className={`text-[10px] tracking-wider rounded-full px-2.5 py-1 font-bold uppercase border ${riskBadgeClass}`}
              >
                risk: {data.risk_level}
              </span>
            )}
          </div>
        </header>
      </Reveal>

      {data.summary && (
        <Reveal delay={0.1}>
          <section>
            <SectionLabel>Behavioral summary</SectionLabel>
            <p className="text-base text-zinc-100 leading-relaxed max-w-3xl">{data.summary}</p>
          </section>
        </Reveal>
      )}

      {detectedRisks.length > 0 && (
        <Reveal delay={0.12}>
          <section>
            <SectionLabel>Detected risks</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {detectedRisks.map((r, i) => (
                <code
                  key={i}
                  className="font-mono text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-md px-2 py-1"
                >
                  {r}
                </code>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {focusAreas.length > 0 && (
        <Reveal delay={0.14}>
          <section>
            <SectionLabel>Reviewer should focus on</SectionLabel>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/80 text-zinc-400 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">File</th>
                    <th className="text-left px-4 py-2.5 font-medium w-24">Lines</th>
                    <th className="text-left px-4 py-2.5 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {focusAreas.map((f, i) => (
                    <tr key={i} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-100">{f.file}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{f.lines}</td>
                      <td className="px-4 py-3 text-zinc-200 leading-relaxed">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </Reveal>
      )}

      {structural.length > 0 && (
        <Reveal delay={0.16}>
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

      <Reveal delay={0.18}>
        <section className="text-xs text-zinc-500 flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-800 pt-5 font-mono">
          {data.tokens_used !== null && <span>{data.tokens_used.toLocaleString()} tokens</span>}
          {data.cost_usd_cents !== null && (
            <span>${(data.cost_usd_cents / 100).toFixed(4)}</span>
          )}
          {flags.file_count !== undefined && <span>files={flags.file_count}</span>}
          {flags.symbol_changes !== undefined && (
            <span>symbol changes={flags.symbol_changes}</span>
          )}
          {data.completed_at && (
            <span>completed {new Date(data.completed_at).toLocaleString()}</span>
          )}
        </section>
      </Reveal>

      {data.github_comment_url && (
        <Reveal delay={0.2}>
          <a
            href={data.github_comment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-green-500 hover:bg-green-400 text-zinc-950 font-medium text-sm transition"
          >
            View on GitHub
            <ArrowUpRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </Reveal>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-3">
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }): React.ReactElement {
  const tone =
    status === 'completed'
      ? 'text-green-400 bg-green-950/30 border-green-900/40'
      : status === 'failed'
        ? 'text-red-400 bg-red-950/30 border-red-900/40'
        : status === 'running'
          ? 'text-blue-400 bg-blue-950/30 border-blue-900/40'
          : 'text-zinc-400 bg-zinc-900 border-zinc-800';
  return (
    <span
      className={`text-[10px] tracking-wider rounded-full px-2.5 py-1 font-bold uppercase border ${tone}`}
    >
      {status}
    </span>
  );
}

function StructuralFileBlock({ file }: { file: StructuralFile }): React.ReactElement {
  const meaningfulChanges = file.changes.filter((c) => c.change !== 'unchanged');

  return (
    <details className="group rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
      <summary className="cursor-pointer px-5 py-3 text-sm flex items-center gap-3 list-none [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-zinc-100">{file.filename}</span>
        <span className="text-zinc-500 text-xs font-mono">({file.language})</span>
        <span className="ml-auto text-xs font-mono text-zinc-400 tabular-nums">
          <span className="text-green-400">+{file.summary.added}</span>{' '}
          <span className="text-yellow-400">~{file.summary.modified}</span>{' '}
          <span className="text-red-400">-{file.summary.removed}</span>
        </span>
        <span className="text-zinc-500 transition-transform group-open:rotate-90">›</span>
      </summary>
      {meaningfulChanges.length > 0 && (
        <div className="px-5 py-4 border-t border-zinc-800 space-y-1.5 font-mono text-xs">
          {meaningfulChanges.map((c, j) => (
            <div key={j} className="flex items-baseline gap-3">
              <span className={`${CHANGE_COLOR[c.change] ?? 'text-zinc-400'} w-20 shrink-0`}>
                {c.change}
              </span>
              <span className="text-zinc-500 w-16 shrink-0">{c.kind}</span>
              <span className="text-zinc-200 truncate">{c.name ?? c.id}</span>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
