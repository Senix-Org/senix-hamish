import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves, at the real webhook route level, that a referred user's first
 * subscription payment event creates exactly one commission ledger row and
 * that a RENEWAL event for the same user creates none. This is the
 * end-to-end guarantee the affiliate deal depends on (10% of first payment
 * only), exercised through POST /api/webhooks/whop with the SDK unwrap
 * mocked, the same harness style as credit-packs.test.ts.
 */

const h = vi.hoisted(() => ({
  unwrap: vi.fn(),
  commissionInserts: [] as Array<Record<string, unknown>>,
  userRow: {
    id: 'u1',
    email: 'u@e.com',
    plan: 'free',
    plan_status: 'active',
    whop_membership_id: null as string | null,
    referred_by_affiliate_id: 'aff1' as string | null,
  },
  pending: [] as Array<Promise<unknown>>,
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
  creditPackForWhopIds: vi.fn(() => null),
  CREDIT_PACK_DETAILS: {},
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
            eq: () => ({ maybeSingle: async () => ({ data: { ...h.userRow } }) }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === 'affiliate_commissions') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            h.commissionInserts.push(payload);
            return { error: null };
          },
        };
      }
      return { insert: async () => ({ error: null }) };
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

beforeEach(() => {
  h.pending.length = 0;
  h.commissionInserts.length = 0;
  h.unwrap.mockReset();
  h.userRow.whop_membership_id = null;
  h.userRow.referred_by_affiliate_id = 'aff1';
});

describe('affiliate commissions through the Whop webhook', () => {
  it('first subscription payment for a referred user records one commission', async () => {
    h.unwrap.mockReturnValue({
      id: 'evt_first',
      type: 'payment.succeeded',
      data: {
        id: 'pay_first',
        metadata: { user_id: 'u1' },
        plan: { id: 'plan_starter' },
        membership: { id: 'mem_1' },
        billing_reason: 'subscription_create',
        subtotal: 18,
        currency: 'usd',
      },
    });

    const res = await POST(reqWith());
    await flush();

    expect(res.status).toBe(200);
    expect(h.commissionInserts).toHaveLength(1);
    expect(h.commissionInserts[0]).toMatchObject({
      affiliate_id: 'aff1',
      user_id: 'u1',
      whop_payment_id: 'pay_first',
      payment_amount_cents: 1800,
      commission_cents: 180,
    });
  });

  it('a RENEWAL event (subscription_cycle) creates NO ledger row', async () => {
    h.userRow.whop_membership_id = 'mem_1'; // established subscriber
    h.unwrap.mockReturnValue({
      id: 'evt_renewal',
      type: 'payment.succeeded',
      data: {
        id: 'pay_renewal',
        metadata: { user_id: 'u1' },
        plan: { id: 'plan_starter' },
        membership: { id: 'mem_1' },
        billing_reason: 'subscription_cycle',
        subtotal: 18,
        currency: 'usd',
      },
    });

    const res = await POST(reqWith());
    await flush();

    expect(res.status).toBe(200);
    expect(h.commissionInserts).toHaveLength(0);
  });

  it('an unreferred user generates no commission even on first payment', async () => {
    h.userRow.referred_by_affiliate_id = null;
    h.unwrap.mockReturnValue({
      id: 'evt_noref',
      type: 'payment.succeeded',
      data: {
        id: 'pay_noref',
        metadata: { user_id: 'u1' },
        plan: { id: 'plan_starter' },
        billing_reason: 'subscription_create',
        subtotal: 18,
      },
    });

    await POST(reqWith());
    await flush();

    expect(h.commissionInserts).toHaveLength(0);
  });
});
