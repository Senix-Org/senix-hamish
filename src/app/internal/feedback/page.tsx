import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type FeedbackCategory = 'bug' | 'feature' | 'question' | 'other';

type FeedbackRow = {
  id: string;
  category: FeedbackCategory;
  message: string;
  page_url: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  created_at: string;
  users: { email: string | null; github_username: string | null } | null;
};

const STATUS_ORDER: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const CATEGORY_STYLES: Record<FeedbackCategory, string> = {
  bug: 'bg-red-500/10 text-red-300 border-red-500/30',
  feature: 'bg-green-500/10 text-green-300 border-green-500/30',
  question: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  other: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
};

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  feature: 'Feature',
  question: 'Question',
  other: 'Other',
};

/**
 * Read-only admin view of every feedback submission. Gated by the
 * Basic Auth in middleware (INTERNAL_PASSWORD). Status edits are
 * intentionally not yet wired up — they live in a future iteration.
 */
export default async function InternalFeedbackPage(): Promise<React.ReactElement> {
  const { data, error } = await supabaseAdmin
    .from('feedback')
    .select(
      'id, category, message, page_url, user_agent, status, created_at, users(email, github_username)'
    )
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as FeedbackRow[];
  const grouped = groupByStatus(rows);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {rows.length} submission{rows.length === 1 ? '' : 's'} total · read-only
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-md border border-red-900/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            Error loading feedback: {error.message}
          </div>
        )}

        <div className="space-y-10">
          {STATUS_ORDER.map((status) => {
            const items = grouped[status];
            if (!items || items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500 mb-4">
                  {STATUS_LABEL[status]} · {items.length}
                </h2>
                <div className="space-y-3">
                  {items.map((row) => (
                    <FeedbackCard key={row.id} row={row} />
                  ))}
                </div>
              </section>
            );
          })}
          {rows.length === 0 && !error && (
            <p className="text-sm text-zinc-500">No feedback yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}

function FeedbackCard({ row }: { row: FeedbackRow }): React.ReactElement {
  const who = row.users?.github_username ?? row.users?.email ?? 'unknown user';
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-medium uppercase tracking-wide rounded px-2 py-0.5 border ${CATEGORY_STYLES[row.category]}`}
          >
            {CATEGORY_LABEL[row.category]}
          </span>
          <span className="text-xs text-zinc-500">{who}</span>
        </div>
        <span className="text-xs text-zinc-500">
          {new Date(row.created_at).toLocaleString()}
        </span>
      </div>

      <p className="mt-4 text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
        {row.message}
      </p>

      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-500">
        {row.page_url && (
          <div className="truncate">
            <dt className="inline text-zinc-600">Page: </dt>
            <dd className="inline text-zinc-400">{row.page_url}</dd>
          </div>
        )}
        {row.user_agent && (
          <div className="truncate">
            <dt className="inline text-zinc-600">UA: </dt>
            <dd className="inline text-zinc-400">{row.user_agent}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function groupByStatus(rows: FeedbackRow[]): Record<FeedbackStatus, FeedbackRow[]> {
  const out: Record<FeedbackStatus, FeedbackRow[]> = {
    open: [],
    in_progress: [],
    resolved: [],
    closed: [],
  };
  for (const r of rows) {
    out[r.status].push(r);
  }
  return out;
}
