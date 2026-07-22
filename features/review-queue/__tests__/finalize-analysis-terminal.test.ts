import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves the token-reservation refund helper is idempotent: it only refunds
 * once per analysis, guarded by a non-terminal status update. Failure means:
 * duplicate refunds on races, or leaked reservations on stranded/failed rows.
 */

const { maybeSingle, update } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  update: vi.fn(),
}));

const recordTokenUsage = vi.hoisted(() => vi.fn());

const builder: Record<string, unknown> = {};
builder.update = (...args: unknown[]) => {
  update(...args);
  return builder;
};
builder.eq = () => builder;
builder.in = () => builder;
builder.select = () => builder;
builder.maybeSingle = maybeSingle;

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: { from: () => builder },
}));

vi.mock('@features/billing/plan-limits', () => ({
  ESTIMATED_TOKENS_PER_REVIEW: 2000,
  recordTokenUsage,
}));

import { finalizeAnalysisAsTerminal } from '@features/review-queue/workflow/steps';

beforeEach(() => {
  maybeSingle.mockReset();
  update.mockReset();
  recordTokenUsage.mockReset();
});

describe('finalizeAnalysisAsTerminal', () => {
  it('updates the row, refunds the reservation, and returns finalized-and-refunded when the row is non-terminal', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'a1' }, error: null });
    recordTokenUsage.mockResolvedValueOnce(1000);

    const result = await finalizeAnalysisAsTerminal('a1', 'u1', 'failed', 'boom');

    expect(result).toBe('finalized-and-refunded');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error_message: 'boom' })
    );
    expect(recordTokenUsage).toHaveBeenCalledWith('u1', 0, 'pr', 2000);
  });

  it('returns already-terminal and skips the refund when the row is already terminal', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await finalizeAnalysisAsTerminal('a1', 'u1', 'failed', 'boom');

    expect(result).toBe('already-terminal');
    expect(recordTokenUsage).not.toHaveBeenCalled();
  });

  it('returns no-user and skips everything when userId is missing', async () => {
    const result = await finalizeAnalysisAsTerminal('a1', null, 'failed', 'boom');

    expect(result).toBe('no-user');
    expect(update).not.toHaveBeenCalled();
    expect(recordTokenUsage).not.toHaveBeenCalled();
  });

  it('still returns finalized-and-refunded even if the refund RPC fails', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'a1' }, error: null });
    recordTokenUsage.mockRejectedValueOnce(new Error('db down'));

    const result = await finalizeAnalysisAsTerminal('a1', 'u1', 'completed', 'skipped');

    expect(result).toBe('finalized-and-refunded');
    expect(recordTokenUsage).toHaveBeenCalledWith('u1', 0, 'pr', 2000);
  });

  it('passes a non-default source through to recordTokenUsage', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'a1' }, error: null });
    recordTokenUsage.mockResolvedValueOnce(1000);

    await finalizeAnalysisAsTerminal('a1', 'u1', 'failed', 'boom', 'mcp');

    expect(recordTokenUsage).toHaveBeenCalledWith('u1', 0, 'mcp', 2000);
  });
});
