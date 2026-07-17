import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves the token-budget rate limiting: the gate atomically checks AND
 * reserves the estimate via the consume_tokens RPC (monthly budget first,
 * then credit packs, so concurrent reviews cannot all pass and collectively
 * exceed the budget), the post-LLM true-up adjusts usage by (actual -
 * reserved) in a single atomic RPC (no lost increments), the monthly counter
 * auto-resets before the gate, and the repo limit is enforced.
 * Failure means: users could consume unlimited paid LLM capacity, or usage
 * accounting would drift from reality.
 */

const { maybeSingle, update, rpc } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  update: vi.fn(),
  rpc: vi.fn(),
}));

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
  supabaseAdmin: { from: () => builder, rpc },
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
  rpc.mockReset();
});

describe('checkTokenLimit (atomic reserve via RPC)', () => {
  it('allows and reserves the estimate when the RPC accepts it', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser({ tokens_used_this_month: 1000 }), error: null });
    rpc.mockResolvedValueOnce({
      data: { allowed: true, from_monthly: 2000, from_packs: 0 },
      error: null,
    });

    const res = await checkTokenLimit('user-1', 2000, 'pr');

    expect(res.allowed).toBe(true);
    if (res.allowed) {
      expect(res.fromMonthly).toBe(2000);
      expect(res.fromPacks).toBe(0);
    }
    expect(rpc).toHaveBeenCalledWith('consume_tokens', {
      user_id: 'user-1',
      tokens_to_consume: 2000,
      monthly_limit: PLAN_LIMITS.free.tokens,
    });
  });

  it('threads the monthly/pack split back out when packs fund the overflow', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: freeUser({ tokens_used_this_month: PLAN_LIMITS.free.tokens - 500 }),
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: { allowed: true, from_monthly: 500, from_packs: 1500 },
      error: null,
    });

    const res = await checkTokenLimit('user-1', 2000, 'pr');

    expect(res.allowed).toBe(true);
    if (res.allowed) {
      expect(res.fromMonthly).toBe(500);
      expect(res.fromPacks).toBe(1500);
    }
  });

  it('blocks when monthly budget and credit packs together cannot cover it', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: freeUser({ tokens_used_this_month: PLAN_LIMITS.free.tokens - 500 }),
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: { allowed: false, reason: 'insufficient_tokens', monthly_remaining: 500, pack_remaining: 0 },
      error: null,
    });

    const res = await checkTokenLimit('user-1', 2000, 'pr');
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/token budget and credit balance exhausted/i);
  });

  it('throws on an RPC error so the gate never silently passes', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser(), error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });
    await expect(checkTokenLimit('user-1', 2000, 'mcp')).rejects.toThrow(/token budget/i);
  });
});

describe('recordTokenUsage (atomic true-up)', () => {
  it('adjusts by ACTUAL minus RESERVED in one atomic RPC', async () => {
    rpc.mockResolvedValueOnce({ data: 4500, error: null });

    const total = await recordTokenUsage('user-1', 3500, 'pr', 2000);

    expect(total).toBe(4500);
    expect(rpc).toHaveBeenCalledWith('adjust_token_usage', { user_id: 'user-1', delta: 1500 });
    // No read-modify-write on the users table anymore.
    expect(update).not.toHaveBeenCalled();
  });

  it('applies a negative delta when actual usage came in under the estimate', async () => {
    rpc.mockResolvedValueOnce({ data: 500, error: null });

    const total = await recordTokenUsage('user-1', 1000, 'mcp', 2000);

    expect(total).toBe(500);
    expect(rpc).toHaveBeenCalledWith('adjust_token_usage', { user_id: 'user-1', delta: -1000 });
  });

  it('skips the RPC entirely when actual equals reserved (delta 0)', async () => {
    maybeSingle.mockResolvedValueOnce({ data: freeUser({ tokens_used_this_month: 2000 }), error: null });

    const total = await recordTokenUsage('user-1', 2000, 'pr', 2000);

    expect(total).toBe(2000);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('increments by the full actual count when nothing was reserved', async () => {
    rpc.mockResolvedValueOnce({ data: 3500, error: null });

    const total = await recordTokenUsage('user-1', 3500, 'pr');

    expect(total).toBe(3500);
    expect(rpc).toHaveBeenCalledWith('adjust_token_usage', { user_id: 'user-1', delta: 3500 });
  });
});

describe('monthly reset', () => {
  it('zeroes tokens_used_this_month BEFORE the gate reserves', async () => {
    // getUserPlan sees a stale reset date and issues a reset update; the
    // gate RPC then reserves against the fresh period.
    maybeSingle.mockResolvedValueOnce({
      data: freeUser({ tokens_used_this_month: 9999, tokens_reset_at: lastMonth }),
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: { allowed: true, from_monthly: 2000, from_packs: 0 },
      error: null,
    });

    const res = await checkTokenLimit('user-1', 2000, 'pr');

    expect(res.allowed).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ tokens_used_this_month: 0 })
    );
    // The reset update must land before the reserve RPC runs.
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
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
