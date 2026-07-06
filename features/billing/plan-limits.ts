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

export type UserPlan = {
  userId: string;
  plan: PlanName;
  planStatus: PlanStatus;
  trialEndsAt: string | null;
  tokensUsedThisMonth: number;
  tokensResetAt: string;
  reposConnected: number;
  /** Alias of tokensUsedThisMonth for read-site clarity. */
  tokensUsed: number;
  tokenLimit: number;
  repoLimit: number;
  limit: (typeof PLAN_LIMITS)[PlanName];
  effectivePlan: PlanName;
  effectiveLimit: (typeof PLAN_LIMITS)[PlanName];
};

type UserPlanRow = {
  plan: string | null;
  plan_status: string | null;
  trial_ends_at: string | null;
  tokens_used_this_month: number | null;
  tokens_reset_at: string | null;
  repos_connected: number | null;
};

type LimitResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Up-front token estimate reserved per review at gate time. Shared by every
 * flow (PR webhook, MCP, playground) so the post-LLM true-up in
 * {@link recordTokenUsage} subtracts exactly what the gate reserved.
 */
export const ESTIMATED_TOKENS_PER_REVIEW = 2000;

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import('@features/shared/supabase');
  return supabaseAdmin;
}

function isPlanName(value: string | null | undefined): value is PlanName {
  return Boolean(value && value in PLAN_LIMITS);
}

function normalizePlan(value: string | null | undefined): PlanName {
  return isPlanName(value) ? value : 'free';
}

function normalizeStatus(value: string | null | undefined): PlanStatus {
  if (
    value === 'active' ||
    value === 'trialing' ||
    value === 'cancelled' ||
    value === 'past_due'
  ) {
    return value;
  }
  return 'active';
}

function currentMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function isBeforeCurrentMonth(value: string | null): boolean {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() < currentMonthStart().getTime();
}

function hasActiveTrial(status: PlanStatus, trialEndsAt: string | null): boolean {
  if (status !== 'trialing' || !trialEndsAt) return false;
  const endsAt = new Date(trialEndsAt);
  return !Number.isNaN(endsAt.getTime()) && endsAt.getTime() > Date.now();
}

function effectivePlan(plan: PlanName, status: PlanStatus, trialEndsAt: string | null): PlanName {
  const activeTrial = hasActiveTrial(status, trialEndsAt);
  if ((status === 'cancelled' || status === 'past_due') && !activeTrial) {
    return 'free';
  }
  if (status === 'trialing' && !activeTrial) {
    return 'free';
  }
  return plan;
}

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = (await supabase
    .from('users')
    .select(
      'plan, plan_status, trial_ends_at, tokens_used_this_month, tokens_reset_at, repos_connected'
    )
    .eq('id', userId)
    .maybeSingle()) as unknown as { data: UserPlanRow | null; error: { message: string } | null };

  if (error) {
    throw new Error(`Failed to load user plan: ${error.message}`);
  }
  if (!data) {
    throw new Error('User not found.');
  }

  let tokensUsed = data.tokens_used_this_month ?? 0;
  let tokensResetAt = data.tokens_reset_at ?? currentMonthStart().toISOString();

  // Auto-reset the monthly token counter at the start of each UTC month.
  if (isBeforeCurrentMonth(data.tokens_reset_at)) {
    tokensResetAt = currentMonthStart().toISOString();
    tokensUsed = 0;

    const { error: resetError } = await supabase
      .from('users')
      .update({
        tokens_used_this_month: 0,
        tokens_reset_at: tokensResetAt,
      })
      .eq('id', userId);

    if (resetError) {
      throw new Error(`Failed to reset monthly token counter: ${resetError.message}`);
    }
  }

  const plan = normalizePlan(data.plan);
  const planStatus = normalizeStatus(data.plan_status);
  const activePlan = effectivePlan(plan, planStatus, data.trial_ends_at);
  const limit = PLAN_LIMITS[plan];
  const effectiveLimit = PLAN_LIMITS[activePlan];

  return {
    userId,
    plan,
    planStatus,
    trialEndsAt: data.trial_ends_at,
    tokensUsedThisMonth: tokensUsed,
    tokensResetAt,
    reposConnected: data.repos_connected ?? 0,
    tokensUsed,
    tokenLimit: limit.tokens,
    repoLimit: limit.repos,
    limit,
    effectivePlan: activePlan,
    effectiveLimit,
  };
}

/**
 * Token budget gate. Atomically checks AND reserves the estimate against the
 * user's monthly budget via the increment_token_usage RPC (migration 012):
 * the user row is locked FOR UPDATE, so concurrent reviews cannot all read
 * the same pre-call usage and collectively exceed the budget. When blocked,
 * nothing is debited.
 *
 * The monthly counter reset runs first (inside getUserPlan), BEFORE the RPC,
 * so the reservation always lands in the current period. Note on the reset:
 * it is idempotent (concurrent resets write the same zero and period start)
 * but it is a plain unconditional update, so exactly at a month boundary a
 * reset racing an in-flight increment can drop that increment. That
 * pre-existing boundary race is documented here, not fixed, to keep this
 * change scoped to the gate itself.
 *
 * After the LLM completes, {@link recordTokenUsage} trues usage up from the
 * reserved estimate to the actual count. If a review dies between the two
 * calls the estimate stays debited, which errs on the conservative side.
 */
export async function checkTokenLimit(
  userId: string,
  estimatedTokens: number,
  // `source` is accepted for call-site clarity and future per-source metering.
  _source: TokenSource
): Promise<LimitResult> {
  const userPlan = await getUserPlan(userId);
  const limit = userPlan.effectiveLimit.tokens;
  const estimate = Math.max(0, Math.round(estimatedTokens));

  const supabase = await getSupabaseAdmin();
  const { data, error } = (await supabase.rpc('increment_token_usage', {
    user_id: userId,
    tokens_to_add: estimate,
    monthly_limit: limit,
  })) as unknown as {
    data: { allowed: boolean } | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to check token budget: ${error.message}`);
  }

  if (!data?.allowed) {
    return {
      allowed: false,
      reason: `Monthly token budget reached for the ${userPlan.effectiveLimit.label} plan.`,
    };
  }

  return { allowed: true };
}

/**
 * True usage up to the actual token count after a review completes. The gate
 * already debited `reservedTokens` (the estimate), so this applies the
 * difference (actual - reserved) in a single atomic UPDATE via the
 * adjust_token_usage RPC — no read-modify-write, no retry loop, no lost
 * increments. The adjustment is never blocked by the budget (the spend
 * already happened) and the counter floors at zero when actual < reserved.
 */
export async function recordTokenUsage(
  userId: string,
  actualTokens: number,
  // Kept for symmetry/observability; the budget is a single shared pool.
  _source: TokenSource,
  /** Estimate already debited by the checkTokenLimit gate; 0 if none was. */
  reservedTokens = 0
): Promise<number> {
  const actual = Math.max(0, Math.round(actualTokens));
  const reserved = Math.max(0, Math.round(reservedTokens));
  const delta = actual - reserved;

  if (delta === 0) {
    const plan = await getUserPlan(userId);
    return plan.tokensUsed;
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = (await supabase.rpc('adjust_token_usage', {
    user_id: userId,
    delta,
  })) as unknown as { data: number | null; error: { message: string } | null };

  if (error) {
    throw new Error(`Failed to record token usage: ${error.message}`);
  }

  return data ?? 0;
}

export async function checkRepoLimit(userId: string): Promise<LimitResult> {
  const userPlan = await getUserPlan(userId);
  const limit = userPlan.effectiveLimit.repos;

  if (limit !== -1 && userPlan.reposConnected >= limit) {
    return {
      allowed: false,
      reason: `Repo limit reached for the ${userPlan.effectiveLimit.label} plan.`,
    };
  }

  return { allowed: true };
}

/**
 * True when the account currently has MORE connected repos than its plan
 * allows (e.g. after a downgrade). Used at analysis time to skip reviews for
 * accounts that are over their repo cap, distinct from {@link checkRepoLimit}
 * which gates connecting one more repo.
 */
export async function isOverRepoLimit(userId: string): Promise<boolean> {
  const userPlan = await getUserPlan(userId);
  const limit = userPlan.effectiveLimit.repos;
  return limit !== -1 && userPlan.reposConnected > limit;
}

export async function syncReposConnected(userId: string): Promise<number> {
  const supabase = await getSupabaseAdmin();
  const { count, error } = await supabase
    .from('repositories')
    .select('id, installations!inner(installed_by_user_id, uninstalled_at)', {
      count: 'exact',
      head: true,
    })
    .eq('installations.installed_by_user_id', userId)
    .is('installations.uninstalled_at', null);

  if (error) {
    throw new Error(`Failed to count connected repos: ${error.message}`);
  }

  const reposConnected = count ?? 0;
  const { error: updateError } = await supabase
    .from('users')
    .update({ repos_connected: reposConnected })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Failed to update connected repo count: ${updateError.message}`);
  }

  return reposConnected;
}
