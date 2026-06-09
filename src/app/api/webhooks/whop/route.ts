import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { planForWhopPlanId, planForWhopProductId, verifyWhopSignature } from '@features/billing/whop';
import type { PlanName, PlanStatus } from '@features/billing/plan-limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AppUserRow = {
  id: string;
  email: string | null;
  plan: PlanName;
  plan_status: PlanStatus;
  whop_membership_id: string | null;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-whop-signature');

  if (!verifyWhopSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error('[whop webhook] invalid JSON', err);
    return NextResponse.json({ ok: true });
  }

  const eventType = extractEventType(payload);
  console.log('[whop webhook] received', {
    eventType,
    eventId: extractEventId(payload),
    membershipId: extractMembershipId(payload),
  });

  try {
    switch (eventType) {
      case 'membership_activated':
        await handleMembershipActivated(payload);
        break;
      case 'membership_deactivated':
        await handleMembershipDeactivated(payload);
        break;
      case 'payment_succeeded':
      case 'invoice_paid':
        await handlePaymentSucceeded(payload);
        break;
      default:
        console.log('[whop webhook] ignored event', { eventType });
        break;
    }
  } catch (err) {
    console.error('[whop webhook] processing failed', {
      eventType,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ready' });
}

async function handleMembershipActivated(payload: unknown): Promise<void> {
  const email = extractEmail(payload);
  const productId = extractProductId(payload);
  const planId = extractPlanId(payload);
  const membershipId = extractMembershipId(payload);
  const eventId = extractEventId(payload);
  // Prefer mapping by the specific plan ID (per period); fall back to the
  // product ID for older configurations.
  const plan = planForWhopPlanId(planId) ?? planForWhopProductId(productId);

  console.log('[whop webhook] membership_activated', {
    email,
    productId,
    planId,
    plan,
    membershipId,
  });

  if (!email || !plan || !membershipId) {
    console.warn('[whop webhook] missing activation fields', { email, productId, membershipId });
    return;
  }

  const { data: user } = (await supabaseAdmin
    .from('users')
    .select('id, email, plan, plan_status, whop_membership_id')
    .eq('email', email)
    .maybeSingle()) as unknown as { data: AppUserRow | null };

  if (!user) {
    console.warn('[whop webhook] no user found for activation email', { email });
    return;
  }

  const trialEndsAt = extractTrialEndsAt(payload);
  const isTrial = Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > Date.now());
  const nextStatus: PlanStatus = isTrial ? 'trialing' : 'active';

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      plan,
      plan_status: nextStatus,
      trial_ends_at: trialEndsAt,
      whop_membership_id: membershipId,
    })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to update activated membership: ${error.message}`);
  }

  await insertPlanEvent({
    userId: user.id,
    eventType: isTrial ? 'trial_started' : 'upgraded',
    fromPlan: user.plan,
    toPlan: plan,
    whopEventId: eventId,
  });
}

async function handleMembershipDeactivated(payload: unknown): Promise<void> {
  const membershipId = extractMembershipId(payload);
  const eventId = extractEventId(payload);

  console.log('[whop webhook] membership_deactivated', { membershipId });

  if (!membershipId) {
    console.warn('[whop webhook] missing deactivated membership id');
    return;
  }

  const { data: user } = (await supabaseAdmin
    .from('users')
    .select('id, email, plan, plan_status, whop_membership_id')
    .eq('whop_membership_id', membershipId)
    .maybeSingle()) as unknown as { data: AppUserRow | null };

  if (!user) {
    console.warn('[whop webhook] no user found for deactivated membership', { membershipId });
    return;
  }

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
    throw new Error(`Failed to deactivate membership: ${error.message}`);
  }

  await insertPlanEvent({
    userId: user.id,
    eventType: 'cancelled',
    fromPlan: user.plan,
    toPlan: 'free',
    whopEventId: eventId,
  });
}

async function handlePaymentSucceeded(payload: unknown): Promise<void> {
  const membershipId = extractMembershipId(payload);
  const eventId = extractEventId(payload);

  console.log('[whop webhook] payment succeeded', { membershipId, eventId });

  if (!membershipId) {
    console.warn('[whop webhook] missing payment membership id');
    return;
  }

  const { data: user } = (await supabaseAdmin
    .from('users')
    .select('id, email, plan, plan_status, whop_membership_id')
    .eq('whop_membership_id', membershipId)
    .maybeSingle()) as unknown as { data: AppUserRow | null };

  if (!user) {
    console.warn('[whop webhook] no user found for payment membership', { membershipId });
    return;
  }

  const wasPastDue = user.plan_status === 'past_due';
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      plan_status: 'active',
      trial_ends_at: null,
    })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to update payment status: ${error.message}`);
  }

  if (wasPastDue) {
    await insertPlanEvent({
      userId: user.id,
      eventType: 'reactivated',
      fromPlan: user.plan,
      toPlan: user.plan,
      whopEventId: eventId,
    });
  }
}

async function insertPlanEvent(input: {
  userId: string;
  eventType:
    | 'upgraded'
    | 'downgraded'
    | 'trial_started'
    | 'trial_ended'
    | 'cancelled'
    | 'reactivated'
    | 'payment_failed';
  fromPlan: string | null;
  toPlan: string | null;
  whopEventId: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('plan_events').insert({
    user_id: input.userId,
    event_type: input.eventType,
    from_plan: input.fromPlan,
    to_plan: input.toPlan,
    whop_event_id: input.whopEventId,
  });

  if (error) {
    console.error('[whop webhook] failed to insert plan event', {
      eventType: input.eventType,
      message: error.message,
    });
  }
}

function extractEventType(payload: unknown): string {
  const raw =
    readString(payload, ['type']) ??
    readString(payload, ['event']) ??
    readString(payload, ['event_type']) ??
    readString(payload, ['data', 'type']) ??
    'unknown';

  return raw.replace(/[.-]/g, '_');
}

function extractEventId(payload: unknown): string | null {
  return (
    readString(payload, ['id']) ??
    readString(payload, ['event_id']) ??
    readString(payload, ['data', 'id']) ??
    null
  );
}

function extractEmail(payload: unknown): string | null {
  return (
    readString(payload, ['email']) ??
    readString(payload, ['user', 'email']) ??
    readString(payload, ['customer', 'email']) ??
    readString(payload, ['data', 'email']) ??
    readString(payload, ['data', 'user', 'email']) ??
    readString(payload, ['data', 'customer', 'email']) ??
    readString(payload, ['data', 'membership', 'user', 'email']) ??
    readString(payload, ['data', 'object', 'user', 'email']) ??
    readString(payload, ['data', 'object', 'customer', 'email']) ??
    null
  );
}

function extractProductId(payload: unknown): string | null {
  return (
    readString(payload, ['product_id']) ??
    readString(payload, ['product', 'id']) ??
    readString(payload, ['data', 'product_id']) ??
    readString(payload, ['data', 'product', 'id']) ??
    readString(payload, ['data', 'membership', 'product_id']) ??
    readString(payload, ['data', 'membership', 'product', 'id']) ??
    readString(payload, ['data', 'object', 'product_id']) ??
    readString(payload, ['data', 'object', 'product', 'id']) ??
    null
  );
}

function extractPlanId(payload: unknown): string | null {
  return (
    readString(payload, ['plan_id']) ??
    readString(payload, ['plan', 'id']) ??
    readString(payload, ['data', 'plan_id']) ??
    readString(payload, ['data', 'plan', 'id']) ??
    readString(payload, ['data', 'membership', 'plan_id']) ??
    readString(payload, ['data', 'membership', 'plan', 'id']) ??
    readString(payload, ['data', 'object', 'plan_id']) ??
    readString(payload, ['data', 'object', 'plan', 'id']) ??
    null
  );
}

function extractMembershipId(payload: unknown): string | null {
  return (
    readString(payload, ['membership_id']) ??
    readString(payload, ['membership', 'id']) ??
    readString(payload, ['data', 'membership_id']) ??
    readString(payload, ['data', 'id']) ??
    readString(payload, ['data', 'membership', 'id']) ??
    readString(payload, ['data', 'object', 'membership_id']) ??
    readString(payload, ['data', 'object', 'membership', 'id']) ??
    readString(payload, ['data', 'object', 'id']) ??
    null
  );
}

function extractTrialEndsAt(payload: unknown): string | null {
  return (
    readString(payload, ['trial_ends_at']) ??
    readString(payload, ['trial_end']) ??
    readString(payload, ['trial_end_date']) ??
    readString(payload, ['data', 'trial_ends_at']) ??
    readString(payload, ['data', 'trial_end']) ??
    readString(payload, ['data', 'membership', 'trial_ends_at']) ??
    readString(payload, ['data', 'membership', 'trial_end']) ??
    readString(payload, ['data', 'object', 'trial_ends_at']) ??
    readString(payload, ['data', 'object', 'trial_end']) ??
    null
  );
}

function readString(payload: unknown, path: string[]): string | null {
  const value = path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return null;
    return (current as Record<string, unknown>)[key];
  }, payload);

  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}
