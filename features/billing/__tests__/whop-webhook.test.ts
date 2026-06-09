import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: a verified Whop "membership activated" webhook upgrades the user's
 * plan, and a "membership deactivated" webhook downgrades them to free and
 * marks the plan cancelled.
 * Failure means: paid customers would not get access, or cancellations would
 * not revoke paid capacity.
 */

const { verifyWhopSignature, planForWhopProductId, planForWhopPlanId } = vi.hoisted(() => ({
  verifyWhopSignature: vi.fn(() => true),
  planForWhopProductId: vi.fn(() => 'starter'),
  planForWhopPlanId: vi.fn(() => null),
}));

const updates: Array<Record<string, unknown>> = [];
const currentUser = {
  id: 'u1', email: 'u@e.com', plan: 'free', plan_status: 'active', whop_membership_id: 'm1',
};

vi.mock('@features/billing/whop', () => ({
  verifyWhopSignature,
  planForWhopProductId,
  planForWhopPlanId,
}));
vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: currentUser }) }) }),
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { eq: () => Promise.resolve({ error: null }) };
      },
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}));

import { POST } from '@/app/api/webhooks/whop/route';

function reqWith(payload: unknown) {
  return {
    text: async () => JSON.stringify(payload),
    headers: new Headers({ 'x-whop-signature': 'sig' }),
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  updates.length = 0;
  verifyWhopSignature.mockReturnValue(true);
  planForWhopProductId.mockReturnValue('starter');
  planForWhopPlanId.mockReturnValue(null);
});

describe('Whop webhook', () => {
  it('upgrades the plan on membership activation (checkout)', async () => {
    await POST(reqWith({
      type: 'membership_activated',
      email: 'u@e.com',
      product_id: 'prod_starter',
      membership_id: 'm1',
    }));
    expect(updates[0]).toMatchObject({ plan: 'starter', plan_status: 'active' });
  });

  it('downgrades to free and cancels on membership deactivation', async () => {
    await POST(reqWith({ type: 'membership_deactivated', membership_id: 'm1' }));
    expect(updates[0]).toMatchObject({ plan: 'free', plan_status: 'cancelled' });
  });

  it('rejects a forged signature with 401 and does not touch the plan', async () => {
    verifyWhopSignature.mockReturnValue(false);
    const res = await POST(reqWith({ type: 'membership_activated' }));
    expect(res.status).toBe(401);
    expect(updates).toHaveLength(0);
  });
});
