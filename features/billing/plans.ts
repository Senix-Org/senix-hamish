/**
 * Pure plan data and types, with NO server dependencies, so this module is
 * safe to import from client components (the pricing/marketing UI) as well as
 * server code. Server logic (getUserPlan, checkTokenLimit, etc.) lives in
 * plan-limits.ts, which pulls in Supabase and other server-only code that
 * cannot bundle for the browser. plan-limits.ts re-exports everything here
 * for back-compat, so existing server imports are unchanged; client
 * components must import plan data from THIS file, never plan-limits.ts.
 */

// Monthly token budgets updated 2026-07-20 (pricing decision):
// free 50k -> 20k, starter 400k -> 500k, team 1M -> 2.5M, pro 2.5M -> 5M.
export const PLAN_LIMITS = {
  free: { repos: 1, tokens: 20_000, label: 'Free' },
  starter: { repos: 3, tokens: 500_000, label: 'Starter' },
  team: { repos: 15, tokens: 2_500_000, label: 'Team' },
  pro: { repos: -1, tokens: 5_000_000, label: 'Pro' },
} as const;

export const PLAN_ORDER = ['free', 'starter', 'team', 'pro'] as const;

export type PlanName = keyof typeof PLAN_LIMITS;
export type PlanStatus = 'active' | 'trialing' | 'cancelled' | 'past_due';
/** Where a token charge originated. Single shared monthly budget. */
export type TokenSource = 'pr' | 'mcp' | 'playground';
