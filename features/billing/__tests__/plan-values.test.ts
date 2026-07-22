import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS, PLAN_ORDER } from '@features/billing/plans';

/**
 * Pins the monthly token budgets decided 2026-07-20. These numbers are the
 * single source of truth for the gate, the pricing page, docs, and marketing
 * sections; a silent change here silently reprices the product, so the exact
 * values are asserted, not just their shape.
 */
describe('plan token budgets (2026-07-20 pricing)', () => {
  it('carries the decided monthly token budgets', () => {
    expect(PLAN_LIMITS.free.tokens).toBe(20_000);
    expect(PLAN_LIMITS.starter.tokens).toBe(500_000);
    expect(PLAN_LIMITS.team.tokens).toBe(2_500_000);
    expect(PLAN_LIMITS.pro.tokens).toBe(5_000_000);
  });

  it('keeps repo limits and plan order unchanged', () => {
    expect(PLAN_LIMITS.free.repos).toBe(1);
    expect(PLAN_LIMITS.starter.repos).toBe(3);
    expect(PLAN_LIMITS.team.repos).toBe(15);
    expect(PLAN_LIMITS.pro.repos).toBe(-1);
    expect(PLAN_ORDER).toEqual(['free', 'starter', 'team', 'pro']);
  });
});
