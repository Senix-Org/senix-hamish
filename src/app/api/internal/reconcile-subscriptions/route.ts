import { NextRequest, NextResponse } from 'next/server';
import { whopsdk } from '@/lib/whop-sdk';
import { supabaseAdmin } from '@features/shared/supabase';
import { planForWhopPlanId } from '@features/billing/whop';
import type { PlanName, PlanStatus } from '@features/billing/plan-limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AppUserRow = {
  id: string;
  plan: PlanName;
  plan_status: PlanStatus;
  whop_membership_id: string | null;
};

type ReconcileResult = {
  activeMembershipsSeen: number;
  activated: number;
  downgraded: number;
  unmatched: number;
};

/**
 * Authorize the caller. Two accepted forms:
 * - The scheduled GitHub Actions workflow (.github/workflows/cron-reconcile.yml)
 *   sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 *   This is the production trigger.
 * - Basic auth against INTERNAL_PASSWORD, matching the other /api/internal/*
 *   routes, for manual runs.
 * When neither secret is configured we allow the request (local/dev).
 */
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const password = process.env.INTERNAL_PASSWORD;
  if (!cronSecret && !password) return true;

  const auth = req.headers.get('authorization') ?? '';

  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  if (password && auth.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice('Basic '.length), 'base64').toString('utf8');
      const [, candidate] = decoded.split(':');
      if (candidate === password) return true;
    } catch {
      // fall through to unauthorized
    }
  }

  return false;
}

/**
 * Periodic reconciliation between Whop and Supabase. Catches silently dropped
 * webhooks in both directions:
 *
 * 1. A Whop membership is active but our user row is still free/cancelled
 *    (a missed activation): re-apply the plan from the membership.
 * 2. Our user row claims a paid, active plan tied to a Whop membership that is
 *    no longer active (a missed deactivation): downgrade to free.
 *
 * Identity is the verified metadata.user_id stored on the membership, falling
 * back to whop_membership_id. Read-only against the request: nothing here
 * trusts client input.
 */
async function reconcile(): Promise<ReconcileResult> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) {
    throw new Error('WHOP_COMPANY_ID is not configured.');
  }

  const result: ReconcileResult = {
    activeMembershipsSeen: 0,
    activated: 0,
    downgraded: 0,
    unmatched: 0,
  };

  // Track which membership ids are currently active in Whop so we can detect
  // Supabase rows that should have been downgraded.
  const activeMembershipIds = new Set<string>();

  for await (const membership of whopsdk.memberships.list({
    company_id: companyId,
    statuses: ['active', 'trialing'],
  })) {
    result.activeMembershipsSeen += 1;
    activeMembershipIds.add(membership.id);

    const userId = readMetadataUserId(membership.metadata);
    const plan = planForWhopPlanId(membership.plan?.id);

    const user = userId
      ? await findUser('id', userId)
      : await findUser('whop_membership_id', membership.id);

    if (!user) {
      result.unmatched += 1;
      continue;
    }

    const desiredStatus: PlanStatus = membership.status === 'trialing' ? 'trialing' : 'active';
    const needsFix =
      user.plan_status !== desiredStatus ||
      user.whop_membership_id !== membership.id ||
      (plan !== null && user.plan !== plan);

    if (needsFix) {
      const update: Record<string, unknown> = {
        plan_status: desiredStatus,
        whop_membership_id: membership.id,
      };
      if (plan) update.plan = plan;

      const { error } = await supabaseAdmin.from('users').update(update).eq('id', user.id);
      if (error) {
        console.error('[reconcile] failed to re-activate user', {
          userId: user.id,
          message: error.message,
        });
      } else {
        result.activated += 1;
      }
    }
  }

  // Downgrade users who look paid+active in Supabase but whose linked
  // membership is no longer active in Whop.
  const { data: paidUsers } = (await supabaseAdmin
    .from('users')
    .select('id, plan, plan_status, whop_membership_id')
    .neq('plan', 'free')
    .in('plan_status', ['active', 'trialing'])) as unknown as { data: AppUserRow[] | null };

  for (const user of paidUsers ?? []) {
    if (!user.whop_membership_id) continue;
    if (activeMembershipIds.has(user.whop_membership_id)) continue;

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        plan: 'free',
        plan_status: 'cancelled',
        trial_ends_at: null,
        plan_expires_at: null,
        whop_membership_id: null,
      })
      .eq('id', user.id);

    if (error) {
      console.error('[reconcile] failed to downgrade stale user', {
        userId: user.id,
        message: error.message,
      });
    } else {
      result.downgraded += 1;
    }
  }

  return result;
}

function readMetadataUserId(metadata: { [key: string]: unknown } | null | undefined): string | null {
  const value = metadata?.user_id;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function findUser(column: 'id' | 'whop_membership_id', value: string): Promise<AppUserRow | null> {
  const { data } = (await supabaseAdmin
    .from('users')
    .select('id, plan, plan_status, whop_membership_id')
    .eq(column, value)
    .maybeSingle()) as unknown as { data: AppUserRow | null };
  return data;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await reconcile();
    console.log('[reconcile] complete', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allow scheduler platforms that issue GET cron requests.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
