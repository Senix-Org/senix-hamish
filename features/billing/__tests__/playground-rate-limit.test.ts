import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves the anonymous playground token limiter: it allows while under the
 * daily token budget, denies once at/over it, FAILS CLOSED (throws) when the
 * counter store is unreachable so an outage cannot become a free unmetered
 * path to the LLM, and records actual tokens atomically.
 */

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: { rpc },
}));

import {
  checkPlaygroundTokenBudget,
  recordPlaygroundTokens,
  PLAYGROUND_DAILY_TOKEN_LIMIT,
} from '@features/billing/playground-rate-limit';

beforeEach(() => rpc.mockReset());

describe('checkPlaygroundTokenBudget', () => {
  it('allows when under the daily token budget', async () => {
    rpc.mockResolvedValue({ data: 1000, error: null });
    const res = await checkPlaygroundTokenBudget('1.2.3.4');
    expect(res.allowed).toBe(true);
    expect(res.used).toBe(1000);
  });

  it('denies once the budget is reached', async () => {
    rpc.mockResolvedValue({ data: PLAYGROUND_DAILY_TOKEN_LIMIT, error: null });
    const res = await checkPlaygroundTokenBudget('1.2.3.4');
    expect(res.allowed).toBe(false);
  });

  it('FAILS CLOSED (throws) when the counter store errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    await expect(checkPlaygroundTokenBudget('1.2.3.4')).rejects.toThrow(/budget lookup failed/);
  });

  it('FAILS CLOSED (throws) when the store returns a non-numeric count', async () => {
    rpc.mockResolvedValue({ data: 'oops', error: null });
    await expect(checkPlaygroundTokenBudget('1.2.3.4')).rejects.toThrow();
  });
});

describe('recordPlaygroundTokens', () => {
  it('returns the new running total from the atomic increment', async () => {
    rpc.mockResolvedValue({ data: 2500, error: null });
    const total = await recordPlaygroundTokens('1.2.3.4', 1500);
    expect(total).toBe(2500);
  });

  it('throws when the increment fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(recordPlaygroundTokens('1.2.3.4', 100)).rejects.toThrow(/increment failed/);
  });
});
