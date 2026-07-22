import { supabaseAdmin } from '@features/shared/supabase';
import { PLAN_LIMITS, PLAN_ORDER } from '@features/billing/plans';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Business health at a glance. Every number comes from ONE SQL round trip:
 * the admin_dashboard_metrics() RPC (migration 017) aggregates in Postgres,
 * so this page never loops over rows and stays O(1) queries as volume grows.
 *
 * MRR source: our own users table (plan x list price for plan_status='active'
 * paid users), NOT the Whop API. Rationale: the DB is what actually gates
 * access, the daily reconcile job keeps it aligned with Whop, and it needs no
 * network call; trialing users are excluded because they have not paid.
 * "Errored" reviews = status completed with risk_level NULL (LLM produced
 * nothing): counted as their own bucket, never hidden in the healthy counts.
 */

type Metrics = {
  signups_today: number;
  signups_week: number;
  users_total: number;
  users_by_plan: Record<string, number>;
  paying_active_by_plan: Record<string, number>;
  mrr_cents: number;
  reviews_total: number;
  reviews_today: number;
  reviews_failed_total: number;
  reviews_24h: number;
  reviews_failed_24h: number;
  reviews_errored_total: number;
  credit_revenue_cents: number;
  credit_packs_sold: number;
  commissions_unpaid_cents: number;
  commissions_total_cents: number;
};

function dollars(centsValue: number): string {
  return `$${(centsValue / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function pct(part: number, whole: number): string {
  if (whole === 0) return '0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export default async function InternalMetricsPage() {
  const { data, error } = (await supabaseAdmin.rpc('admin_dashboard_metrics')) as unknown as {
    data: Metrics | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 font-mono text-sm text-zinc-100">
        <h1 className="mb-4 text-2xl font-bold">Metrics</h1>
        <p className="text-red-400">
          Failed to load metrics: {error?.message ?? 'no data'}. Is migration 017 applied?
        </p>
      </main>
    );
  }

  const m = data;
  const payingTotal = Object.values(m.paying_active_by_plan).reduce((s, n) => s + n, 0);
  const freeCount = m.users_by_plan.free ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 p-8 font-mono text-sm text-zinc-100">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Business metrics</h1>
        <nav className="flex gap-4 text-xs text-blue-300">
          <a href="/internal">status</a>
          <a href="/internal/affiliates">affiliates</a>
          <a href="/internal/feedback">feedback</a>
        </nav>
      </div>

      <h2 className="mb-3 text-lg font-bold">Growth</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Signups today" value={String(m.signups_today)} />
        <Stat label="Signups (7d)" value={String(m.signups_week)} />
        <Stat label="Total users" value={String(m.users_total)} />
        <Stat
          label="Free vs paying"
          value={`${freeCount} / ${payingTotal}`}
          sub={PLAN_ORDER.filter((p) => p !== 'free')
            .map((p) => `${PLAN_LIMITS[p].label}: ${m.paying_active_by_plan[p] ?? 0}`)
            .join(' · ')}
        />
      </div>

      <h2 className="mb-3 text-lg font-bold">Revenue</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="MRR" value={dollars(m.mrr_cents)} sub="active paid users × list price" />
        <Stat
          label="Credit pack revenue"
          value={dollars(m.credit_revenue_cents)}
          sub={`${m.credit_packs_sold} packs sold (all time)`}
        />
        <Stat
          label="Commissions owed"
          value={dollars(m.commissions_unpaid_cents)}
          sub={`total ever: ${dollars(m.commissions_total_cents)}`}
        />
      </div>

      <h2 className="mb-3 text-lg font-bold">Reviews</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Reviews (all time)" value={String(m.reviews_total)} />
        <Stat label="Reviews today" value={String(m.reviews_today)} />
        <Stat
          label="Failure rate (all time)"
          value={pct(m.reviews_failed_total, m.reviews_total)}
          sub={`${m.reviews_failed_total} failed`}
        />
        <Stat
          label="Failure rate (24h)"
          value={pct(m.reviews_failed_24h, m.reviews_24h)}
          sub={`${m.reviews_failed_24h} of ${m.reviews_24h}`}
        />
        <Stat
          label="Errored (completed, no result)"
          value={String(m.reviews_errored_total)}
          sub="completed but LLM produced no risk level"
        />
      </div>
    </main>
  );
}
