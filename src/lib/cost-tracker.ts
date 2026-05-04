import { supabaseAdmin } from '@/lib/supabase';

export const DAILY_COST_CAP_CENTS = 500;

type CostRow = {
  cost_usd_cents: number | null;
};

function startOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

/**
 * Sum `cost_usd_cents` across all analyses created since 00:00 UTC today.
 *
 * Rows with NULL cost (e.g. analyses where the LLM step was skipped or
 * never ran) contribute 0. Used by the worker's cap gate and surfaced on
 * the internal dashboard.
 */
export async function getTodayCostCents(): Promise<number> {
  const since = startOfTodayUtcIso();
  const { data, error } = await supabaseAdmin
    .from('analyses')
    .select('cost_usd_cents')
    .gte('created_at', since);

  if (error) {
    throw new Error(`Failed to load today's cost: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as CostRow[];
  return rows.reduce((sum, r) => sum + (r.cost_usd_cents ?? 0), 0);
}

/**
 * Return true if today's cumulative LLM spend has exceeded the daily cap.
 *
 * The worker checks this before each LLM call and skips the analysis if
 * over cap, so we degrade gracefully instead of leaking spend.
 */
export async function isOverDailyCostCap(): Promise<boolean> {
  const spent = await getTodayCostCents();
  return spent > DAILY_COST_CAP_CENTS;
}
