import { supabaseAdmin } from '@features/shared/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type StructuralChange = {
  change: string;
  kind: string;
  id: string;
};

type StructuralFile = {
  filename: string;
  language: string;
  summary: { added: number; removed: number; modified: number; unchanged: number };
  changes: StructuralChange[];
};

type Analysis = {
  id: string;
  status: string;
  commit_sha: string | null;
  created_at: string;
  risk_flags: {
    file_count?: number;
    supported_file_count?: number;
    additions?: number;
    deletions?: number;
    symbol_changes?: number;
    structural_diff?: StructuralFile[];
  } | null;
};

type PullRequest = {
  id: string;
  github_pr_number: number;
  title: string;
  state: string;
  head_sha: string | null;
  updated_at: string;
  repositories: { full_name: string } | null;
};

export default async function InternalPage() {
  const [{ data: events }, { data: prs }, { data: analyses }, { count: installCount }] =
    await Promise.all([
      supabaseAdmin
        .from('webhook_events')
        .select('event_type, action, signature_valid, processed, received_at')
        .order('received_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('pull_requests')
        .select('id, github_pr_number, title, state, head_sha, updated_at, repository_id, repositories(full_name)')
        .order('updated_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('analyses')
        .select('id, status, commit_sha, risk_flags, created_at, pull_request_id')
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin.from('installations').select('*', { count: 'exact', head: true }),
    ]);

  const prList = (prs ?? []) as unknown as PullRequest[];
  const analysisList = (analyses ?? []) as unknown as Analysis[];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-mono text-sm">
      <h1 className="text-2xl font-bold mb-2">Internal Status</h1>
      <p className="text-zinc-500 mb-2">Installs: {installCount ?? 0}</p>
      <nav className="mb-8 flex gap-4 text-xs text-blue-300">
        <a href="/internal/metrics">metrics</a>
        <a href="/internal/affiliates">affiliates</a>
        <a href="/internal/feedback">feedback</a>
        <a href="/internal/test">test</a>
      </nav>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">Last 20 webhook events</h2>
        <div className="space-y-1">
          {(events ?? []).map((e, i) => (
            <div key={i} className="flex gap-4 text-zinc-300">
              <span className="text-zinc-500 w-44">{new Date(e.received_at).toLocaleString()}</span>
              <span className="w-32">{e.event_type}</span>
              <span className="w-28 text-zinc-400">{e.action ?? '-'}</span>
              <span className={e.signature_valid ? 'text-green-400' : 'text-red-400'}>
                {e.signature_valid ? 'sig:ok' : 'sig:bad'}
              </span>
              <span className={e.processed ? 'text-green-400' : 'text-yellow-400'}>
                {e.processed ? 'done' : 'pending'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">Recent pull requests</h2>
        <div className="space-y-1">
          {prList.map((p) => (
            <div key={p.id} className="flex gap-4 text-zinc-300">
              <span className="w-56 truncate">{p.repositories?.full_name}</span>
              <span className="w-12">#{p.github_pr_number}</span>
              <span className="w-20">{p.state}</span>
              <span className="w-20 text-zinc-500">{p.head_sha?.slice(0, 7)}</span>
              <span className="truncate">{p.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Recent analyses</h2>
        <div className="space-y-4">
          {analysisList.map((a) => {
            const flags = a.risk_flags ?? {};
            const structural = flags.structural_diff ?? [];
            const changedFiles = structural.filter(
              (f) => f.summary.added + f.summary.modified + f.summary.removed > 0
            );
            return (
              <div key={a.id} className="rounded-lg border border-zinc-800 p-4 bg-zinc-900/40">
                <div className="flex gap-4 text-zinc-300 mb-2">
                  <span className="text-zinc-500">{new Date(a.created_at).toLocaleString()}</span>
                  <span className="font-bold text-blue-400">{a.status}</span>
                  <span className="text-zinc-500">{a.commit_sha?.slice(0, 7)}</span>
                </div>
                <div className="text-zinc-400 text-xs mb-3">
                  files={flags.file_count ?? '?'} (supported={flags.supported_file_count ?? '?'}) · +{flags.additions ?? 0}/-{flags.deletions ?? 0} · symbol changes={flags.symbol_changes ?? 0}
                </div>
                {changedFiles.length > 0 && (
                  <div className="space-y-2">
                    {changedFiles.map((f, i) => (
                      <div key={i} className="text-xs">
                        <div className="text-zinc-200 font-bold">
                          {f.filename} <span className="text-zinc-500">({f.language})</span>
                        </div>
                        <div className="ml-4 mt-1 space-y-0.5">
                          {f.changes
                            .filter((c) => c.change !== 'unchanged')
                            .map((c, j) => (
                              <div key={j} className="text-zinc-400">
                                <span
                                  className={
                                    c.change === 'added'
                                      ? 'text-green-400'
                                      : c.change === 'removed'
                                      ? 'text-red-400'
                                      : 'text-yellow-400'
                                  }
                                >
                                  {c.change.padEnd(10, ' ')}
                                </span>
                                <span className="text-zinc-500"> {c.kind} </span>
                                <span className="text-zinc-200">{c.id}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-zinc-600 mt-12">⚠️ This page is unauthenticated. Add password protection before sharing the URL.</p>
    </main>
  );
}
