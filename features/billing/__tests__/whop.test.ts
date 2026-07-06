import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyWhopSignature, planForWhopProductId, whopProductIdForPlan } from '@features/billing/whop';

/**
 * Proves: Whop webhook signatures are verified (forged/replayed payloads
 * rejected), and product-id to plan mapping is correct in both directions.
 * Failure means: an attacker could forge billing events to grant paid plans.
 */

const SECRET = 'whop-secret';

beforeEach(() => {
  process.env.WHOP_WEBHOOK_SECRET = SECRET;
  process.env.WHOP_STARTER_PRODUCT_ID = 'prod_starter';
  process.env.WHOP_TEAM_PRODUCT_ID = 'prod_team';
  process.env.WHOP_PRO_PRODUCT_ID = 'prod_pro';
});

function sign(body: string) {
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

describe('verifyWhopSignature', () => {
  it('accepts a valid signature with sha256= prefix', () => {
    const body = '{"type":"x"}';
    expect(verifyWhopSignature(body, `sha256=${sign(body)}`)).toBe(true);
  });

  it('accepts a valid signature with v1= prefix', () => {
    const body = '{"type":"x"}';
    expect(verifyWhopSignature(body, `v1=${sign(body)}`)).toBe(true);
  });

  it('rejects a forged signature', () => {
    expect(verifyWhopSignature('{"type":"x"}', 'sha256=' + 'a'.repeat(64))).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyWhopSignature('{}', null)).toBe(false);
  });

  it('rejects when the secret is not configured', () => {
    delete process.env.WHOP_WEBHOOK_SECRET;
    const body = '{}';
    expect(verifyWhopSignature(body, `sha256=${sign(body)}`)).toBe(false);
  });
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
