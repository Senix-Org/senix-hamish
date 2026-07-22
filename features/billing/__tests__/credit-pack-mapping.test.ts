import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { creditPackPlanId, creditPackForWhopIds, CREDIT_PACK_DETAILS } from '@features/billing/whop';

/**
 * Proves: the credit pack env-var mapping resolves plan ids and reverse-maps
 * Whop plan/product ids to the right pack, and never collides with
 * subscription plan ids. Failure means checkout would 500 or the webhook
 * would grant the wrong pack size.
 */

const ENV_KEYS = [
  'WHOP_CREDITS_SMALL_ID',
  'WHOP_CREDITS_SMALL_PRODUCT_ID',
  'WHOP_CREDITS_LARGE_ID',
  'WHOP_CREDITS_LARGE_PRODUCT_ID',
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.WHOP_CREDITS_SMALL_ID = 'plan_small';
  process.env.WHOP_CREDITS_SMALL_PRODUCT_ID = 'prod_small';
  process.env.WHOP_CREDITS_LARGE_ID = 'plan_large';
  process.env.WHOP_CREDITS_LARGE_PRODUCT_ID = 'prod_large';
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('credit pack mapping', () => {
  it('resolves configured plan ids per pack', () => {
    expect(creditPackPlanId('small')).toBe('plan_small');
    expect(creditPackPlanId('large')).toBe('plan_large');
  });

  it('returns null when a pack is not configured', () => {
    delete process.env.WHOP_CREDITS_SMALL_ID;
    expect(creditPackPlanId('small')).toBeNull();
  });

  it('reverse-maps plan and product ids to the pack', () => {
    expect(creditPackForWhopIds({ planId: 'plan_small' })).toBe('small');
    expect(creditPackForWhopIds({ productId: 'prod_large' })).toBe('large');
    expect(creditPackForWhopIds({ planId: 'plan_starter_monthly' })).toBeNull();
    expect(creditPackForWhopIds({})).toBeNull();
  });

  it('carries the confirmed token amounts', () => {
    expect(CREDIT_PACK_DETAILS.small).toMatchObject({ price: 10, credits: 200_000 });
    expect(CREDIT_PACK_DETAILS.large).toMatchObject({ price: 25, credits: 600_000 });
  });
});
