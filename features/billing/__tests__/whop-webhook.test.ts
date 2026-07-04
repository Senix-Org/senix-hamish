import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: a Whop webhook is acted on only after the SDK verifies its
 * signature; a verified "membership.activated" upgrades the user identified by
 * the payload's metadata.user_id; "membership.deactivated" downgrades them to
 * free; a forged signature is rejected with 401 and touches nothing; and a
 * duplicate event id is ignored (idempotency).
 * Failure means: paid customers would not get access, cancellations would not
 * revoke access, forged requests could grant access, or retries could double
 * process.
 */

// Hoisted so the vi.mock factories (which run before module-level code) can
// reference this shared state and these spies.
const h = vi.hoisted(() => ({
  unwrap: vi.fn(),
  planForWhopPlanId: vi.fn(() => 'starter' as string | null),
  planForWhopProductId: vi.fn(() => null as string | null),
  pending: [] as Array<Promise<unknown>>,
  updates: [] as Array<{ payload: Record<string, unknown>; eq: [string, unknown] }>,
  state: { processedExists: false },
  userRow: {
    id: 'u1',
    email: 'u@e.com',
    plan: 'free',
    plan_status: 'active',
    whop_membership_id: null as string | null,
  },
}));

const { unwrap, planForWhopPlanId, planForWhopProductId, pending, updates, userRow } = h;

// The route defers fulfillment with next/server's after(). Mock it to capture
// the background promise so tests can flush it and assert on the effects.
vi.mock('next/server', () => ({
  after: (p: Promise<unknown>) => {
    h.pending.push(p);
  },
}));

vi.mock('@/lib/whop-sdk', () => ({ whopsdk: { webhooks: { unwrap: h.unwrap } } }));
vi.mock('@features/billing/whop', () => ({
  planForWhopPlanId: h.planForWhopPlanId,
  planForWhopProductId: h.planForWhopProductId,
}));

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'processed_webhook_events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: h.state.processedExists ? { event_id: 'x' } : null }),
            }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.userRow }) }) }),
          update: (payload: Record<string, unknown>) => ({
            eq: (col: string, val: unknown) => {
              h.updates.push({ payload, eq: [col, val] });
              return Promise.resolve({ error: null });
            },
          }),
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
  await Promise.all(pending);
}

beforeEach(() => {
  updates.length = 0;
  pending.length = 0;
  h.state.processedExists = false;
  userRow.plan = 'free';
  userRow.plan_status = 'active';
  userRow.whop_membership_id = null;
  unwrap.mockReset();
  planForWhopPlanId.mockReturnValue('starter');
  planForWhopProductId.mockReturnValue(null);
});

describe('Whop webhook (SDK verified)', () => {
  it('upgrades the user identified by metadata.user_id on activation', async () => {
    unwrap.mockReturnValue({
      id: 'evt_1',
      type: 'membership.activated',
      data: {
        id: 'mem_1',
        status: 'active',
        metadata: { user_id: 'u1' },
        plan: { id: 'plan_starter' },
        product: { id: 'prod_x' },
        user: { email: 'u@e.com' },
        renewal_period_end: '1750000000',
      },
    });

    const res = await POST(reqWith());
    await flush();

    expect(res.status).toBe(200);
    expect(updates[0].eq).toEqual(['id', 'u1']);
    expect(updates[0].payload).toMatchObject({
      plan: 'starter',
      plan_status: 'active',
      whop_membership_id: 'mem_1',
    });
  });

  it('downgrades to free and cancels on deactivation', async () => {
    unwrap.mockReturnValue({
      id: 'evt_2',
      type: 'membership.deactivated',
      data: { id: 'mem_1', metadata: { user_id: 'u1' } },
    });

    await POST(reqWith());
    await flush();

    expect(updates[0].eq).toEqual(['id', 'u1']);
    expect(updates[0].payload).toMatchObject({ plan: 'free', plan_status: 'cancelled' });
  });

  it('rejects a forged signature with 401 and touches nothing', async () => {
    unwrap.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const res = await POST(reqWith());
    await flush();

    expect(res.status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it('ignores a duplicate (already processed) event', async () => {
    h.state.processedExists = true;
    unwrap.mockReturnValue({
      id: 'evt_1',
      type: 'membership.activated',
      data: { id: 'mem_1', status: 'active', metadata: { user_id: 'u1' }, plan: { id: 'plan_starter' } },
    });

    await POST(reqWith());
    await flush();

    expect(updates).toHaveLength(0);
  });
});
