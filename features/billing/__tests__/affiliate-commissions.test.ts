import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves the affiliate commission money logic: a referred user's FIRST
 * subscription payment (billing_reason 'subscription_create') records exactly
 * one 10% commission; a RENEWAL ('subscription_cycle') records nothing; the
 * nullable-billing_reason fallback uses the pre-event membership state; and
 * duplicate payments (webhook retries) are no-ops via the UNIQUE constraint.
 * Failure means: paying a YouTuber repeatedly for the same user, paying for
 * renewals, or silently never paying commissions at all.
 */

const h = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  state: { insertError: null as { message: string } | null },
}));

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: async (payload: Record<string, unknown>) => {
        if (table === 'affiliate_commissions') {
          h.inserts.push(payload);
          return { error: h.state.insertError };
        }
        return { error: null };
      },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      update: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }),
    }),
  },
}));

import {
  maybeGrantAffiliateCommission,
  isFirstSubscriptionPayment,
  commissionCents,
} from '@features/billing/affiliates';

const referredUser = {
  id: 'u1',
  referred_by_affiliate_id: 'aff1',
  whop_membership_id: null as string | null,
};

beforeEach(() => {
  h.inserts.length = 0;
  h.state.insertError = null;
});

describe('commissionCents', () => {
  it('is exactly 10%, rounded to the cent', () => {
    expect(commissionCents(1800)).toBe(180); // $18 starter -> $1.80
    expect(commissionCents(7900)).toBe(790);
    expect(commissionCents(19900)).toBe(1990);
    expect(commissionCents(1)).toBe(0); // 0.1 cent rounds down
  });
});

describe('isFirstSubscriptionPayment', () => {
  it('is true for subscription_create regardless of membership state', () => {
    expect(
      isFirstSubscriptionPayment(
        { billing_reason: 'subscription_create' },
        { whop_membership_id: 'mem_1' }
      )
    ).toBe(true);
  });

  it('is false for renewals and every other explicit reason', () => {
    for (const reason of ['subscription_cycle', 'subscription_update', 'one_time', 'manual']) {
      expect(
        isFirstSubscriptionPayment({ billing_reason: reason }, { whop_membership_id: null })
      ).toBe(false);
    }
  });

  it('falls back to pre-event membership state when billing_reason is null', () => {
    expect(
      isFirstSubscriptionPayment({ billing_reason: null }, { whop_membership_id: null })
    ).toBe(true);
    expect(
      isFirstSubscriptionPayment({ billing_reason: null }, { whop_membership_id: 'mem_1' })
    ).toBe(false);
  });
});

describe('maybeGrantAffiliateCommission', () => {
  it('records a 10% commission on the first subscription payment', async () => {
    await maybeGrantAffiliateCommission(referredUser, {
      id: 'pay_1',
      billing_reason: 'subscription_create',
      subtotal: 18,
      currency: 'usd',
    });

    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      affiliate_id: 'aff1',
      user_id: 'u1',
      whop_payment_id: 'pay_1',
      payment_amount_cents: 1800,
      commission_cents: 180,
      currency: 'usd',
    });
  });

  it('a RENEWAL (subscription_cycle) never creates a ledger row', async () => {
    await maybeGrantAffiliateCommission(
      { ...referredUser, whop_membership_id: 'mem_1' },
      { id: 'pay_2', billing_reason: 'subscription_cycle', subtotal: 18 }
    );

    expect(h.inserts).toHaveLength(0);
  });

  it('does nothing for users with no affiliate attribution', async () => {
    await maybeGrantAffiliateCommission(
      { id: 'u2', referred_by_affiliate_id: null, whop_membership_id: null },
      { id: 'pay_3', billing_reason: 'subscription_create', subtotal: 18 }
    );

    expect(h.inserts).toHaveLength(0);
  });

  it('treats a duplicate payment (unique violation) as an already-recorded no-op', async () => {
    h.state.insertError = { message: 'duplicate key value violates unique constraint' };

    await expect(
      maybeGrantAffiliateCommission(referredUser, {
        id: 'pay_1',
        billing_reason: 'subscription_create',
        subtotal: 18,
      })
    ).resolves.toBeUndefined();
  });

  it('uses settlement_amount when subtotal is null, and skips zero/invalid amounts', async () => {
    await maybeGrantAffiliateCommission(referredUser, {
      id: 'pay_4',
      billing_reason: 'subscription_create',
      subtotal: null,
      settlement_amount: 79,
    });
    expect(h.inserts[0]).toMatchObject({ payment_amount_cents: 7900, commission_cents: 790 });

    h.inserts.length = 0;
    await maybeGrantAffiliateCommission(referredUser, {
      id: 'pay_5',
      billing_reason: 'subscription_create',
      subtotal: 0,
    });
    expect(h.inserts).toHaveLength(0);
  });
});
