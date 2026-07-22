import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Proves: a payment.succeeded carrying credits metadata grants a credit pack
 * row and never touches subscription state; the plan/product id mapping is
 * only a fallback when metadata is absent; a duplicate payment (unique
 * violation) is a no-op; and a subscription payment never reaches the credit
 * path. Failure means: paid top-ups would not grant tokens, could be granted
 * twice, or a $10 top-up could corrupt a user's plan/plan_status.
 */

const h = vi.hoisted(() => ({
  unwrap: vi.fn(),
  creditPackForWhopIds: vi.fn(() => null as 'small' | 'large' | null),
  pending: [] as Array<Promise<unknown>>,
  userUpdates: [] as Array<Record<string, unknown>>,
  creditInserts: [] as Array<Record<string, unknown>>,
  state: { creditInsertError: null as { message: string } | null },
}));

vi.mock('next/server', () => ({
  after: (p: Promise<unknown>) => {
    h.pending.push(p);
  },
}));

vi.mock('@/lib/whop-sdk', () => ({ whopsdk: { webhooks: { unwrap: h.unwrap } } }));

vi.mock('@features/billing/whop', () => ({
  planForWhopPlanId: vi.fn(() => 'starter'),
  planForWhopProductId: vi.fn(() => null),
  creditPackForWhopIds: h.creditPackForWhopIds,
  CREDIT_PACK_DETAILS: {
    small: { label: 'Small credit pack', price: 10, credits: 200_000 },
    large: { label: 'Large credit pack', price: 25, credits: 600_000 },
  },
}));

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'processed_webhook_events') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'u1',
                  email: 'u@e.com',
                  plan: 'starter',
                  plan_status: 'active',
                  whop_membership_id: 'mem_1',
                },
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: () => {
              h.userUpdates.push(payload);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'credit_packs') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            h.creditInserts.push(payload);
            return { error: h.state.creditInsertError };
          },
        };
      }
      return { insert: async () => ({ error: null }) }; // plan_events
    },
  },
}));

import { POST } from '@/app/api/webhooks/whop/route';

function reqWith(): Parameters<typeof POST>[0] {
  return {
    text: async () => '{}',
    headers: new Headers({ 'whop-signature': 'sig' }),
  } as unknown as Parameters<typeof POST>[0];
}

async function flush(): Promise<void> {
  await Promise.all(h.pending);
}

function paymentEvent(data: Record<string, unknown>) {
  return { id: 'evt_credit_1', type: 'payment.succeeded', data };
}

beforeEach(() => {
  h.pending.length = 0;
  h.userUpdates.length = 0;
  h.creditInserts.length = 0;
  h.state.creditInsertError = null;
  h.unwrap.mockReset();
  h.creditPackForWhopIds.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('credit pack payments (payment.succeeded)', () => {
  it('grants a pack from verified credits metadata and skips subscription logic', async () => {
    h.unwrap.mockReturnValue(
      paymentEvent({
        id: 'pay_1',
        metadata: { user_id: 'u1', kind: 'credits', pack: 'large' },
        plan: { id: 'plan_credits_large' },
      })
    );

    const res = await POST(reqWith());
    await flush();

    expect(res.status).toBe(200);
    expect(h.creditInserts).toHaveLength(1);
    expect(h.creditInserts[0]).toMatchObject({
      user_id: 'u1',
      pack: 'large',
      credits: 600_000,
      whop_payment_id: 'pay_1',
    });
    // The critical invariant: no users-row update of any kind.
    expect(h.userUpdates).toHaveLength(0);
  });

  it('falls back to plan/product id mapping only when metadata is not credits', async () => {
    h.creditPackForWhopIds.mockReturnValue('small');
    h.unwrap.mockReturnValue(
      paymentEvent({
        id: 'pay_2',
        metadata: { user_id: 'u1' }, // no kind: purchased via Whop-hosted page
        plan: { id: 'plan_credits_small' },
      })
    );

    await POST(reqWith());
    await flush();

    expect(h.creditPackForWhopIds).toHaveBeenCalledWith({
      planId: 'plan_credits_small',
      productId: null,
    });
    expect(h.creditInserts).toHaveLength(1);
    expect(h.creditInserts[0]).toMatchObject({ pack: 'small', credits: 200_000 });
    expect(h.userUpdates).toHaveLength(0);
  });

  it('treats a duplicate payment (unique violation) as already granted', async () => {
    h.state.creditInsertError = { message: 'duplicate key value violates unique constraint' };
    h.unwrap.mockReturnValue(
      paymentEvent({
        id: 'pay_1',
        metadata: { user_id: 'u1', kind: 'credits', pack: 'small' },
      })
    );

    const res = await POST(reqWith());
    await flush();

    // No throw: the event completes and is marked processed.
    expect(res.status).toBe(200);
    expect(h.userUpdates).toHaveLength(0);
  });

  it('routes a subscription payment through subscription logic, never credits', async () => {
    h.unwrap.mockReturnValue(
      paymentEvent({
        id: 'pay_3',
        metadata: { user_id: 'u1', plan: 'starter', period: 'monthly' },
        plan: { id: 'plan_starter_monthly' },
        membership: { id: 'mem_1' },
      })
    );

    await POST(reqWith());
    await flush();

    expect(h.creditInserts).toHaveLength(0);
    expect(h.userUpdates).toHaveLength(1);
    expect(h.userUpdates[0]).toMatchObject({ plan_status: 'active' });
  });
});
