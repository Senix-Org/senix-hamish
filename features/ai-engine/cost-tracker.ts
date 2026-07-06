import { supabaseAdmin } from '@features/shared/supabase';

export const DAILY_COST_CAP_CENTS = 500;

/**
 * Up-front estimate used when gating a new analysis against the daily cap.
 * Typical analyses land at 1-3 cents; tune alongside DAILY_COST_CAP_CENTS.
 */
export const ESTIMATED_ANALYSIS_COST_CENTS = 2;

function startOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

/**
 * Sum `cost_usd_cents` across all analyses created since 00:00 UTC today.
 *
 * The SUM runs in Postgres via a PostgREST aggregate, so one number comes
 * back instead of every row created today. Rows with NULL cost (analyses
 * where the LLM step was skipped or never ran) contribute 0. Surfaced on
 * the internal dashboard.
 */
export async function getTodayCostCents(): Promise<number> {
  const since = startOfTodayUtcIso();
  const { data, error } = (await supabaseAdmin
    .from('analyses')
    .select('cost_usd_cents.sum()')
    .gte('created_at', since)
    .single()) as unknown as { data: { sum: number | null } | null; error: { message: string } | null };

  if (error) {
    throw new Error(`Failed to load today's cost: ${error.message}`);
  }

  return data?.sum ?? 0;
}

/**
 * Return true if starting another analysis now would push today's cumulative
 * LLM spend past the daily cap.
 *
 * The check runs inside the check_and_reserve_daily_cost RPC (migration 011)
 * so the aggregate and the comparison happen in one database transaction,
 * instead of a check-then-act read in the Worker. Soft cap: concurrent calls
 * within the same transaction window can still collectively overshoot by one
 * estimate each, but the window is a single fast SQL call rather than a
 * full-table read plus JS sum.
 *
 * The worker checks this before each LLM call and skips the analysis if
 * over cap, so we degrade gracefully instead of leaking spend.
 */
export async function isOverDailyCostCap(): Promise<boolean> {
  const { data, error } = (await supabaseAdmin.rpc('check_and_reserve_daily_cost', {
    estimate_cents: ESTIMATED_ANALYSIS_COST_CENTS,
    cap_cents: DAILY_COST_CAP_CENTS,
    day_start: startOfTodayUtcIso(),
  })) as unknown as { data: boolean | null; error: { message: string } | null };

  if (error) {
    throw new Error(`Failed to check daily cost cap: ${error.message}`);
  }

  // RPC returns true when the estimate still fits under the cap.
  return data === false;
}
