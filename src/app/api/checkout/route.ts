import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { supabaseAdmin } from '@features/shared/supabase';
import { resolveCheckoutPlanId } from '@features/billing/whop';
import type { BillingPeriod, PaidPlanName } from '@features/billing/whop';
import { whopsdk } from '@/lib/whop-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAID_PLANS = new Set<PaidPlanName>(['starter', 'team', 'pro']);

type CheckoutResponse = {
  sessionId: string;
  planId: string | null;
  purchaseUrl: string;
};

function parsePeriod(body: unknown): BillingPeriod {
  const raw =
    body && typeof body === 'object' ? (body as Record<string, unknown>).period : undefined;
  return raw === 'yearly' ? 'yearly' : 'monthly';
}

function parsePlan(body: unknown): string {
  if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).plan === 'string') {
    return ((body as Record<string, unknown>).plan as string).toLowerCase();
  }
  return '';
}

/**
 * Create a Whop checkout configuration (server-side) that is cryptographically
 * tied to the signed-in user. The user identity is stamped into the checkout
 * configuration's `metadata`, which Whop copies onto the resulting
 * payment/membership objects and replays in the verified webhook. That is the
 * only trustworthy link between a payment and our user: the client never sends,
 * and we never read, a user id from the request body.
 *
 * The returned `sessionId` is the checkout configuration id. The frontend feeds
 * it to <WhopCheckoutEmbed sessionId=...> so the rendered checkout inherits the
 * metadata we attached here.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  // Resolve the application user row id. This is distinct from the Supabase
  // auth user id, and it is the id the webhook will update by, so it is what we
  // stamp into the checkout metadata.
  const { data: appUser } = (await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()) as unknown as { data: { id: string } | null };

  if (!appUser) {
    return NextResponse.json({ error: 'No application account found.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const plan = parsePlan(body);
  if (plan === 'free') {
    return NextResponse.json({ error: 'Free plan does not need checkout.' }, { status: 400 });
  }
  if (!PAID_PLANS.has(plan as PaidPlanName)) {
    return NextResponse.json({ error: 'Unknown billing plan.' }, { status: 400 });
  }

  const period = parsePeriod(body);
  const planId = resolveCheckoutPlanId(plan as PaidPlanName, period);
  if (!planId) {
    return NextResponse.json({ error: 'Whop plan is not configured.' }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;

  try {
    const config = await whopsdk.checkoutConfigurations.create({
      plan_id: planId,
      // The verified webhook is matched back to this user via metadata.user_id.
      metadata: { user_id: appUser.id, plan, period },
      redirect_url: `${origin}/checkout/complete`,
    });

    const payload: CheckoutResponse = {
      sessionId: config.id,
      planId: config.plan?.id ?? planId,
      purchaseUrl: config.purchase_url,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
