import { waitUntil } from '@vercel/functions';
import type { NextRequest } from 'next/server';
import type WhopNamespace from '@whop/sdk';
import { whopsdk } from '@/lib/whop-sdk';

type UnwrapWebhookEvent = WhopNamespace.UnwrapWebhookEvent;
import { supabaseAdmin } from '@features/shared/supabase';
import { planForWhopPlanId, planForWhopProductId } from '@features/billing/whop';
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

/**
 * Whop webhook entry point.
 *
 * Security model: we never trust anything in the request except the bytes,
 * which `whopsdk.webhooks.unwrap` verifies against the signing secret. A forged
 * or tampered body fails verification and is rejected with 401 before any work
 * happens. The authenticated payload's `metadata.user_id` (which we stamped on
 * the checkout configuration in /api/checkout) is the only identity we act on.
 *
 * We verify synchronously, then do fulfillment in the background via waitUntil
 * and return 200 fast, per Whop's guidance. Whop retries non-2xx and timeouts,
 * so handleWebhookEvent is idempotent (keyed on the webhook event id).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const requestBodyText = await request.text();
  const headers = Object.fromEntries(request.headers);

  let webhookData: UnwrapWebhookEvent;
  try {
    // Throws on a bad/forged signature. We surface that as a non-2xx rather
    // than swallowing it and returning 200.
    webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });
  } catch (err) {
    console.error('[whop webhook] signature verification failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response('Invalid signature', { status: 401 });
  }

  waitUntil(handleWebhookEvent(webhookData));

  return new Response('OK', { status: 200 });
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ status: 'ready' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function handleWebhookEvent(event: UnwrapWebhookEvent): Promise<void> {
  logWebhookPayload(event);

  // Idempotency: Whop retries deliveries, so a given event id may arrive more
  // than once. Skip anything we have already processed.
  if (await alreadyProcessed(event.id)) {
    console.log('[whop webhook] duplicate event ignored', { eventId: event.id, type: event.type });
    return;
  }

  try {
    switch (event.type) {
      case 'membership.activated':
        await handleMembershipActivated(event);
        break;
      case 'membership.deactivated':
        await handleMembershipDeactivated(event);
        break;
      case 'payment.succeeded':
        await handlePaymentSucceeded(event);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event);
        break;
      default:
        console.log('[whop webhook] ignored event', { type: event.type, eventId: event.id });
        break;
    }
  } catch (err) {
    // Do not record the event as processed if handling threw, so Whop's retry
    // (or the reconciliation job) gets another chance.
    console.error('[whop webhook] processing failed', {
      type: event.type,
      eventId: event.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  await markProcessed(event.id, event.type);
}

// --- Event handlers ---------------------------------------------------------

async function handleMembershipActivated(
  event: Extract<UnwrapWebhookEvent, { type: 'membership.activated' }>
): Promise<void> {
  const membership = event.data;
  const plan =
    planForWhopPlanId(membership.plan?.id) ?? planForWhopProductId(membership.product?.id);

  const user = await resolveUser({
    userId: readMetadataUserId(membership.metadata),
    membershipId: membership.id,
    email: membership.user?.email ?? null,
  });

  if (!user || !plan) {
    console.warn('[whop webhook] activation could not be applied', {
      eventId: event.id,
      resolvedUser: user?.id ?? null,
      plan,
    });
    return;
  }

  const isTrial = membership.status === 'trialing';
  const nextStatus: PlanStatus = isTrial ? 'trialing' : 'active';

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      plan,
      plan_status: nextStatus,
      whop_membership_id: membership.id,
      plan_expires_at: unixToIso(membership.renewal_period_end),
      trial_ends_at: isTrial ? unixToIso(membership.renewal_period_end) : null,
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
    whopEventId: event.id,
  });
}

async function handleMembershipDeactivated(
  event: Extract<UnwrapWebhookEvent, { type: 'membership.deactivated' }>
): Promise<void> {
  const membership = event.data;
  const user = await resolveUser({
    userId: readMetadataUserId(membership.metadata),
    membershipId: membership.id,
    email: membership.user?.email ?? null,
  });

  if (!user) {
    console.warn('[whop webhook] deactivation could not be applied', { eventId: event.id });
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
    whopEventId: event.id,
  });
}

async function handlePaymentSucceeded(
  event: Extract<UnwrapWebhookEvent, { type: 'payment.succeeded' }>
): Promise<void> {
  const payment = event.data;
  const user = await resolveUser({
    userId: readMetadataUserId(payment.metadata),
    membershipId: payment.membership?.id ?? null,
    email: null,
  });

  if (!user) {
    console.warn('[whop webhook] payment.succeeded could not be applied', { eventId: event.id });
    return;
  }

  // First payment may arrive before/with membership.activated; map the plan
  // when we can so access turns on regardless of event ordering.
  const mappedPlan = planForWhopPlanId(payment.plan?.id) ?? planForWhopProductId(payment.product?.id);
  const wasPastDue = user.plan_status === 'past_due';

  const update: Record<string, unknown> = { plan_status: 'active', trial_ends_at: null };
  if (mappedPlan && user.plan === 'free') {
    update.plan = mappedPlan;
  }
  if (payment.membership?.id && !user.whop_membership_id) {
    update.whop_membership_id = payment.membership.id;
  }

  const { error } = await supabaseAdmin.from('users').update(update).eq('id', user.id);
  if (error) {
    throw new Error(`Failed to apply payment.succeeded: ${error.message}`);
  }

  if (wasPastDue) {
    await insertPlanEvent({
      userId: user.id,
      eventType: 'reactivated',
      fromPlan: user.plan,
      toPlan: (update.plan as string) ?? user.plan,
      whopEventId: event.id,
    });
  }
}

async function handlePaymentFailed(
  event: Extract<UnwrapWebhookEvent, { type: 'payment.failed' }>
): Promise<void> {
  const payment = event.data;
  const user = await resolveUser({
    userId: readMetadataUserId(payment.metadata),
    membershipId: payment.membership?.id ?? null,
    email: null,
  });

  if (!user) {
    console.warn('[whop webhook] payment.failed could not be applied', { eventId: event.id });
    return;
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ plan_status: 'past_due' })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to apply payment.failed: ${error.message}`);
  }

  await insertPlanEvent({
    userId: user.id,
    eventType: 'payment_failed',
    fromPlan: user.plan,
    toPlan: user.plan,
    whopEventId: event.id,
  });
}

// --- Identity resolution ----------------------------------------------------

/**
 * Resolve the application user this event belongs to. The verified
 * `metadata.user_id` is authoritative. The membership id and email are
 * defense-in-depth fallbacks for legacy memberships created before metadata
 * stamping, never a substitute when metadata is present.
 */
async function resolveUser(input: {
  userId: string | null;
  membershipId: string | null;
  email: string | null;
}): Promise<AppUserRow | null> {
  if (input.userId) {
    const byId = await findUser('id', input.userId);
    if (byId) return byId;
    console.warn('[whop webhook] metadata.user_id did not match a user row', {
      userId: input.userId,
    });
  }
  if (input.membershipId) {
    const byMembership = await findUser('whop_membership_id', input.membershipId);
    if (byMembership) return byMembership;
  }
  if (input.email) {
    return findUser('email', input.email);
  }
  return null;
}

async function findUser(column: 'id' | 'whop_membership_id' | 'email', value: string) {
  const { data } = (await supabaseAdmin
    .from('users')
    .select('id, email, plan, plan_status, whop_membership_id')
    .eq(column, value)
    .maybeSingle()) as unknown as { data: AppUserRow | null };
  return data;
}

function readMetadataUserId(metadata: { [key: string]: unknown } | null | undefined): string | null {
  const value = metadata?.user_id;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// --- Idempotency ------------------------------------------------------------

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const { data } = (await supabaseAdmin
    .from('processed_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()) as unknown as { data: { event_id: string } | null };
  return Boolean(data);
}

async function markProcessed(eventId: string, eventType: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('processed_webhook_events')
    .insert({ event_id: eventId, event_type: eventType });
  // A unique-violation here means a concurrent delivery already claimed it,
  // which is fine; anything else is worth surfacing.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    console.error('[whop webhook] failed to record processed event', {
      eventId,
      message: error.message,
    });
  }
}

// --- Helpers ----------------------------------------------------------------

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

/** Convert a Whop Unix timestamp (seconds, as string or number) to ISO. */
function unixToIso(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const seconds = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Log a redacted snapshot of the event. Used to confirm, against a real test
 * delivery, exactly where metadata.user_id lands (see the metadata line). PII
 * and card data are masked; structure and metadata are preserved.
 */
function logWebhookPayload(event: UnwrapWebhookEvent): void {
  const metadata =
    'metadata' in event.data ? (event.data as { metadata?: unknown }).metadata : undefined;
  console.log('[whop webhook] received', {
    type: event.type,
    eventId: event.id,
    dataId: (event.data as { id?: string }).id ?? null,
    metadata,
    redactedPayload: JSON.stringify(event, redactSecrets),
  });
}

const REDACTED_KEYS = new Set([
  'email',
  'license_key',
  'card_last4',
  'billing_address',
  'phone_number',
  'name',
  'username',
]);

function redactSecrets(key: string, value: unknown): unknown {
  if (REDACTED_KEYS.has(key) && value) return '[redacted]';
  return value;
}
