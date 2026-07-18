/**
 * Pure plan data and types, with NO server dependencies, so this module is
 * safe to import from client components (the pricing/marketing UI) as well as
 * server code. Server logic (getUserPlan, checkTokenLimit, etc.) lives in
 * plan-limits.ts, which pulls in Supabase and other server-only code that
 * cannot bundle for the browser. plan-limits.ts re-exports everything here
 * for back-compat, so existing server imports are unchanged; client
 * components must import plan data from THIS file, never plan-limits.ts.
 */

export const PLAN_LIMITS = {
  free: { repos: 1, tokens: 50_000, label: 'Free' },
  starter: { repos: 3, tokens: 400_000, label: 'Starter' },
  team: { repos: 15, tokens: 1_000_000, label: 'Team' },
  pro: { repos: -1, tokens: 2_500_000, label: 'Pro' },
} as const;

export const PLAN_ORDER = ['free', 'starter', 'team', 'pro'] as const;

export type PlanName = keyof typeof PLAN_LIMITS;
export type PlanStatus = 'active' | 'trialing' | 'cancelled' | 'past_due';
/** Where a token charge originated. Single shared monthly budget. */
export type TokenSource = 'pr' | 'mcp' | 'playground';
