import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves the token-budget rate limiting: a user is blocked once their
 * monthly token usage (plus the estimate for this review) would exceed the
 * plan budget, allowed while under it, usage is recorded by the ACTUAL token
 * count (not the estimate) with optimistic locking, the monthly counter
 * auto-resets, and the repo limit is enforced.
 * Failure means: users could consume unlimited paid LLM capacity, or usage
 * accounting would drift from reality.
 */

const { maybeSingle, update } = vi.hoisted(() => ({ maybeSingle: vi.fn(), update: vi.fn() }));

const builder: Record<string, unknown> = {};
builder.select = () => builder;
builder.update = (...args: unknown[]) => {
  update(...args);
  return builder;
};
builder.eq = () => builder;
builder.is = () => builder;
builder.maybeSingle = maybeSingle;

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: { from: () => builder },
}));

import {
  checkTokenLimit,
  recordTokenUsage,
  checkRepoLimit,
  isOverRepoLimit,
  getUserPlan,
  PLAN_LIMITS,
} from '@features/billing/plan-limits';

const now = new Date().toISOString();
const lastMonth = new Date(
  Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)
).toISOString();

function freeUser(overrides: Record<string, unknown> = {}) {
  return {
    plan: 'free',
    plan_status: 'active',
    trial_ends_at: null,
    tokens_used_this_month: 0,
    tokens_reset_at: now,
    repos_connected: 0,
    ...overrides,
  };
}

beforeEach(() => {
  maybeSingle.mockReset();
  update.mockReset();
});

describe('checkTokenLimit (free plan)', () => {
  it('allows when usage plus the estimate is under the budget', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser({ tokens_used_this_month: 1000 }), error: null });
    const res = await checkTokenLimit('user-1', 2000, 'pr');
    expect(res.allowed).toBe(true);
  });

  it('blocks when usage plus the estimate would exceed the budget', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: freeUser({ tokens_used_this_month: PLAN_LIMITS.free.tokens - 500 }),
      error: null,
    });
    const res = await checkTokenLimit('user-1', 2000, 'pr');
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/token budget reached/i);
  });

  it('does not mutate usage on a pre-check (no increment)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser({ tokens_used_this_month: 0 }), error: null });
    await checkTokenLimit('user-1', 2000, 'mcp');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('recordTokenUsage', () => {
  it('increments by the ACTUAL token count, not the estimate', async () => {
    // 1st maybeSingle: getUserPlan; 2nd: the optimistic update returning a row.
    maybeSingle
      .mockResolvedValueOnce({ data: freeUser({ tokens_used_this_month: 1000 }), error: null })
      .mockResolvedValueOnce({ data: { id: 'user-1' }, error: null });

    const total = await recordTokenUsage('user-1', 3500, 'pr');

    expect(total).toBe(4500);
    expect(update).toHaveBeenCalledWith({ tokens_used_this_month: 4500 });
  });

  it('retries on a lost optimistic race, then succeeds', async () => {
    maybeSingle
      // attempt 1: read, then update returns null (someone else won)
      .mockResolvedValueOnce({ data: freeUser({ tokens_used_this_month: 1000 }), error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      // attempt 2: read fresh value, update succeeds
      .mockResolvedValueOnce({ data: freeUser({ tokens_used_this_month: 1200 }), error: null })
      .mockResolvedValueOnce({ data: { id: 'user-1' }, error: null });

    const total = await recordTokenUsage('user-1', 100, 'pr');
    expect(total).toBe(1300);
  });
});

describe('monthly reset', () => {
  it('zeroes tokens_used_this_month when the reset timestamp is before this month', async () => {
    // getUserPlan sees a stale reset date and issues a reset update, then the
    // record increment starts from zero.
    maybeSingle
      .mockResolvedValueOnce({
        data: freeUser({ tokens_used_this_month: 9999, tokens_reset_at: lastMonth }),
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: 'user-1' }, error: null });

    const total = await recordTokenUsage('user-1', 200, 'pr');

    // First update is the monthly reset to 0; the increment then starts at 0.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ tokens_used_this_month: 0 })
    );
    expect(total).toBe(200);
  });
});

describe('getUserPlan (token usage the dashboard/billing render)', () => {
  it('exposes tokensUsed and the plan tokenLimit for display', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: freeUser({ tokens_used_this_month: 12_451 }),
      error: null,
    });
    const plan = await getUserPlan('user-1');
    expect(plan.tokensUsed).toBe(12_451);
    expect(plan.tokenLimit).toBe(PLAN_LIMITS.free.tokens);
    // The dashboard renders "X / Y tokens used" + a percent of the budget.
    const percent = Math.min(100, Math.round((plan.tokensUsed / plan.tokenLimit) * 100));
    expect(percent).toBe(25);
  });
});

describe('checkRepoLimit (free plan)', () => {
  it('blocks connecting a repo when the free repo limit (1) is reached', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser({ repos_connected: 1 }), error: null });
    const res = await checkRepoLimit('user-1');
    expect(res.allowed).toBe(false);
  });

  it('allows connecting a repo when under the limit', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser({ repos_connected: 0 }), error: null });
    const res = await checkRepoLimit('user-1');
    expect(res.allowed).toBe(true);
  });
});

describe('isOverRepoLimit (GAP 3, analysis-time skip)', () => {
  it('is true when connected repos exceed the plan cap (e.g. after downgrade)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser({ repos_connected: 3 }), error: null });
    expect(await isOverRepoLimit('user-1')).toBe(true);
  });

  it('is false when at or under the cap', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser({ repos_connected: 1 }), error: null });
    expect(await isOverRepoLimit('user-1')).toBe(false);
  });
});
