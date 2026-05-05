import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RISK_BADGE: Record<string, string> = {
  low: 'text-green-400 bg-green-950/50',
  medium: 'text-yellow-400 bg-yellow-950/50',
  high: 'text-red-400 bg-red-950/50',
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
    (data.risk_level && RISK_BADGE[data.risk_level]) ?? 'text-zinc-400 bg-zinc-800';

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="text-xs text-zinc-500 flex flex-wrap gap-2">
          <span className="text-zinc-300">{repoName}</span>
          {pr?.github_pr_number !== undefined && <span>#{pr.github_pr_number}</span>}
          {pr?.author_login && <span>by {pr.author_login}</span>}
          <span>· {new Date(data.created_at).toLocaleString()}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{pr?.title ?? '(untitled PR)'}</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {data.commit_sha && <span>{data.commit_sha.slice(0, 7)}</span>}
          <span>{data.status}</span>
          {data.risk_level && (
            <span
              className={`text-xs rounded px-2 py-0.5 font-bold uppercase ${riskBadgeClass}`}
            >
              {data.risk_level}
            </span>
          )}
        </div>
      </header>

      {data.summary && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Summary</h2>
          <p className="text-zinc-100 leading-relaxed">{data.summary}</p>
        </section>
      )}

      {detectedRisks.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Detected risks</h2>
          <div className="flex flex-wrap gap-1">
            {detectedRisks.map((r, i) => (
              <span key={i} className="text-xs bg-zinc-800 text-zinc-200 rounded px-2 py-0.5">
                {r}
              </span>
            ))}
          </div>
        </section>
      )}

      {focusAreas.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Focus areas</h2>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-left px-4 py-2 font-medium">Lines</th>
                  <th className="text-left px-4 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {focusAreas.map((f, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-zinc-100">{f.file}</td>
                    <td className="px-4 py-2 text-zinc-400">{f.lines}</td>
                    <td className="px-4 py-2 text-zinc-300">{f.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {structural.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Structural diff</h2>
          <div className="space-y-2">
            {structural.map((f, i) => (
              <StructuralFileBlock key={i} file={f} />
            ))}
          </div>
        </section>
      )}

      <section className="text-xs text-zinc-500 flex flex-wrap gap-4 border-t border-zinc-800 pt-4">
        {data.tokens_used !== null && <span>{data.tokens_used} tokens</span>}
        {data.cost_usd_cents !== null && (
          <span>${(data.cost_usd_cents / 100).toFixed(4)}</span>
        )}
        {flags.file_count !== undefined && <span>files={flags.file_count}</span>}
        {flags.symbol_changes !== undefined && (
          <span>symbol changes={flags.symbol_changes}</span>
        )}
        {data.completed_at && <span>completed {new Date(data.completed_at).toLocaleString()}</span>}
      </section>

      {data.github_comment_url && (
        <a
          href={data.github_comment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-medium transition"
        >
          View on GitHub →
        </a>
      )}
    </div>
  );
}

function StructuralFileBlock({ file }: { file: StructuralFile }): React.ReactElement {
  const meaningfulChanges = file.changes.filter((c) => c.change !== 'unchanged');

  return (
    <details className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <summary className="cursor-pointer px-4 py-2 text-sm flex items-center gap-3">
        <span className="text-zinc-100 font-medium">{file.filename}</span>
        <span className="text-zinc-500 text-xs">({file.language})</span>
        <span className="ml-auto text-xs text-zinc-500">
          +{file.summary.added} ~{file.summary.modified} -{file.summary.removed}
        </span>
      </summary>
      {meaningfulChanges.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-800 space-y-1">
          {meaningfulChanges.map((c, j) => (
            <div key={j} className="text-xs">
              <span
                className={
                  c.change === 'added'
                    ? 'text-green-400'
                    : c.change === 'removed'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                }
              >
                {c.change.padEnd(10, ' ')}
              </span>
              <span className="text-zinc-500">{c.kind} </span>
              <span className="text-zinc-200">{c.name ?? c.id}</span>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
