import { supabaseAdmin } from '@/lib/supabase';
import RequeueButton from './requeue-button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FocusArea = {
  file: string;
  lines: string;
  reason: string;
};

type RiskFlags = {
  file_count?: number;
  symbol_changes?: number;
  detected_risks?: string[];
};

type AnalysisRow = {
  id: string;
  status: string;
  commit_sha: string | null;
  created_at: string;
  error_message: string | null;
  summary: string | null;
  risk_level: string | null;
  focus_areas: FocusArea[] | null;
  risk_flags: RiskFlags | null;
};

const STATUS_COLOR: Record<string, string> = {
  queued: 'text-zinc-400',
  running: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

const RISK_BADGE: Record<string, string> = {
  low: 'text-green-400 bg-green-950/50',
  medium: 'text-yellow-400 bg-yellow-950/50',
  high: 'text-red-400 bg-red-950/50',
};

/**
 * Internal test panel — quick view of recent analyses with a manual
 * "requeue all failed" trigger. Protected by the Basic Auth middleware
 * (matcher `/internal/:path*` covers this route).
 */
export default async function TestPanelPage(): Promise<React.ReactElement> {
  const { data: rows } = await supabaseAdmin
    .from('analyses')
    .select(
      'id, status, commit_sha, risk_flags, created_at, error_message, summary, risk_level, focus_areas'
    )
    .order('created_at', { ascending: false })
    .limit(10);

  const analyses = (rows ?? []) as unknown as AnalysisRow[];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-mono text-sm">
      <h1 className="text-2xl font-bold mb-2">Test Panel</h1>
      <p className="text-zinc-500 mb-8">10 most recent analyses · manual recovery</p>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">Recent analyses</h2>
        <div className="space-y-3">
          {analyses.map((a) => {
            const statusColor = STATUS_COLOR[a.status] ?? 'text-zinc-300';
            const flags = a.risk_flags ?? {};
            const detectedRisks = flags.detected_risks ?? [];
            const focusAreas = a.focus_areas ?? [];
            const riskBadgeClass =
              (a.risk_level && RISK_BADGE[a.risk_level]) ?? 'text-zinc-400 bg-zinc-800';

            return (
              <div
                key={a.id}
                className="rounded-lg border border-zinc-800 p-4 bg-zinc-900/40 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${statusColor}`}>{a.status}</span>
                  <span className="text-zinc-500 text-xs">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>

                {a.summary && (
                  <div className="flex items-start gap-2">
                    <p className="text-base text-zinc-100 flex-1 leading-snug">{a.summary}</p>
                    {a.risk_level && (
                      <span
                        className={`text-xs rounded px-2 py-0.5 font-bold uppercase ${riskBadgeClass}`}
                      >
                        {a.risk_level}
                      </span>
                    )}
                  </div>
                )}

                {detectedRisks.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {detectedRisks.map((r, i) => (
                      <span
                        key={i}
                        className="text-xs bg-zinc-800 text-zinc-200 rounded px-2 py-0.5"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                {focusAreas.length > 0 && (
                  <div>
                    <div className="text-zinc-500 text-xs">Reviewer should focus on:</div>
                    <div className="space-y-0.5 mt-1">
                      {focusAreas.map((f, i) => (
                        <div key={i} className="text-xs text-zinc-300 break-words">
                          <span className="text-zinc-100">{f.file}</span>{' '}
                          <span className="text-zinc-500">(lines {f.lines})</span>{' '}
                          — {f.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                  <span>{a.commit_sha?.slice(0, 7) ?? '-'}</span>
                  <span>files={flags.file_count ?? '?'}</span>
                  <span>symbol changes={flags.symbol_changes ?? 0}</span>
                </div>

                {a.error_message && (
                  <div className="text-red-400 text-xs break-words">{a.error_message}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Actions</h2>
        <RequeueButton />
      </section>
    </main>
  );
}
