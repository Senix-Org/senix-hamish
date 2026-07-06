import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: the idempotency claim is the INSERT itself — the first request for
 * a delivery id owns processing, a concurrent or later retry hits the unique
 * violation (23505) and is reported as a duplicate, and any other insert
 * error fails OPEN (claimed) so real webhooks are never dropped.
 * Failure means: concurrent GitHub retries would create duplicate analyses
 * and comments, or a transient DB error would suppress a legitimate delivery.
 */

const single = vi.fn();

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      insert: () => ({ select: () => ({ single }) }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
  },
}));

import { claimDelivery } from '@features/webhook/idempotency';

const input = {
  deliveryId: 'd-1',
  eventType: 'pull_request',
  action: 'opened',
  payload: { action: 'opened' },
};

beforeEach(() => {
  single.mockReset();
});

describe('claimDelivery', () => {
  it('claims when the insert lands (first delivery of this id)', async () => {
    single.mockResolvedValue({ data: { id: 'row-1' }, error: null });
    expect(await claimDelivery(input)).toBe('claimed');
  });

  it('reports a duplicate on a unique violation (concurrent or earlier retry)', async () => {
    single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    expect(await claimDelivery(input)).toBe('duplicate');
  });

  it('fails open (claimed) on any other insert error', async () => {
    single.mockResolvedValue({ data: null, error: { code: '57014', message: 'db down' } });
    expect(await claimDelivery(input)).toBe('claimed');
  });
});
