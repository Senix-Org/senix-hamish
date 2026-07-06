import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: the daily cost cap gate goes through the atomic
 * check_and_reserve_daily_cost RPC (sum + compare in one transaction) and
 * the dashboard total uses a SQL aggregate instead of pulling every row.
 * Failure means: a loop or abuse could drain the LLM budget unbounded, or
 * the gate would regress to the racy full-table scan.
 */

const { single, rpc } = vi.hoisted(() => ({ single: vi.fn(), rpc: vi.fn() }));

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ gte: () => ({ single }) }) }),
    rpc,
  },
}));

import {
  isOverDailyCostCap,
  getTodayCostCents,
  DAILY_COST_CAP_CENTS,
  ESTIMATED_ANALYSIS_COST_CENTS,
} from '@features/ai-engine/cost-tracker';

beforeEach(() => {
  single.mockReset();
  rpc.mockReset();
});

describe('getTodayCostCents (SQL aggregate)', () => {
  it('returns the database-side SUM, one number instead of all rows', async () => {
    single.mockResolvedValue({ data: { sum: 150 }, error: null });
    expect(await getTodayCostCents()).toBe(150);
  });

  it('treats a NULL sum (no analyses today) as 0', async () => {
    single.mockResolvedValue({ data: { sum: null }, error: null });
    expect(await getTodayCostCents()).toBe(0);
  });

  it('throws on a DB error so the caller does not silently keep spending blind', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'db down' } });
    await expect(getTodayCostCents()).rejects.toThrow(/Failed to load/);
  });
});

describe('isOverDailyCostCap (atomic RPC gate)', () => {
  it('is under cap when the RPC allows the estimate', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await isOverDailyCostCap()).toBe(false);
    expect(rpc).toHaveBeenCalledWith(
      'check_and_reserve_daily_cost',
      expect.objectContaining({
        estimate_cents: ESTIMATED_ANALYSIS_COST_CENTS,
        cap_cents: DAILY_COST_CAP_CENTS,
      })
    );
  });

  it('is over cap when the RPC rejects the estimate (review must be skipped)', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await isOverDailyCostCap()).toBe(true);
  });

  it('throws on an RPC error so the caller does not silently keep spending', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    await expect(isOverDailyCostCap()).rejects.toThrow(/Failed to check/);
  });
});
