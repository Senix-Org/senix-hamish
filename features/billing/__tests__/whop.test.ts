import { describe, it, expect, beforeEach } from 'vitest';
import { planForWhopProductId, whopProductIdForPlan } from '@features/billing/whop';

/**
 * Proves: product-id to plan mapping is correct in both directions.
 * (Webhook signature verification lives in the Whop SDK's webhooks.unwrap,
 * covered by features/billing/__tests__/whop-webhook.test.ts; the old manual
 * verification helper in whop.ts was dead code and has been removed.)
 * Failure means: billing events would map to the wrong plan.
 */

beforeEach(() => {
  process.env.WHOP_STARTER_PRODUCT_ID = 'prod_starter';
  process.env.WHOP_TEAM_PRODUCT_ID = 'prod_team';
  process.env.WHOP_PRO_PRODUCT_ID = 'prod_pro';
});

describe('product/plan mapping', () => {
  it('maps a product id to its plan', () => {
    expect(planForWhopProductId('prod_team')).toBe('team');
  });

  it('returns null for an unknown product id', () => {
    expect(planForWhopProductId('prod_unknown')).toBeNull();
  });

  it('maps a plan to its product id', () => {
    expect(whopProductIdForPlan('pro')).toBe('prod_pro');
  });
});
