import { supabaseAdmin } from '@features/shared/supabase';

/**
 * Affiliate (YouTuber) referral commissions.
 *
 * Deal: 10% of the referred user's FIRST successful subscription payment,
 * one time, never on renewals. Detection is billing_reason-first
 * ('subscription_create' = first subscription payment, 'subscription_cycle' =
 * renewal); because the field is typed nullable, a null billing_reason falls
 * back to "the user had no membership on file yet when this payment arrived"
 * (whop_membership_id was null on the row read at the start of the webhook,
 * i.e. before this event's own updates). Either way, the DB is the last word:
 * affiliate_commissions has UNIQUE(user_id) and UNIQUE(whop_payment_id), so a
 * mis-tagged renewal or a retried delivery can never create a second
 * commission — the insert conflicts and is treated as a no-op.
 */

/** Cookie that carries the referral code from /yt/{code} through signup. */
export const AFFILIATE_COOKIE = 'senix_ref';
export const AFFILIATE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const COMMISSION_RATE = 0.1;

export function commissionCents(paymentAmountCents: number): number {
  return Math.round(paymentAmountCents * COMMISSION_RATE);
}

export type CommissionPayment = {
  id?: string | null;
  billing_reason?: string | null;
  /** Whop payment amounts are decimal currency units (e.g. 18 = $18.00). */
  subtotal?: number | null;
  settlement_amount?: number | null;
  currency?: string | null;
};

export type CommissionUser = {
  id: string;
  referred_by_affiliate_id: string | null;
  /** Membership id as it was BEFORE this webhook's own updates. */
  whop_membership_id: string | null;
};

/**
 * Is this payment the user's first subscription payment?
 * billing_reason is authoritative when present; when null, fall back to
 * "no membership existed on the user row yet". Renewals are always excluded.
 */
export function isFirstSubscriptionPayment(
  payment: CommissionPayment,
  user: Pick<CommissionUser, 'whop_membership_id'>
): boolean {
  const reason = payment.billing_reason ?? null;
  if (reason === 'subscription_create') return true;
  if (reason !== null) return false; // cycle, update, one_time, manual: never
  return user.whop_membership_id === null;
}

/**
 * Record the 10% commission for a referred user's first subscription payment.
 * Never throws — a commission bookkeeping failure must not fail the payment
 * webhook. Duplicate inserts (retried delivery, or any second payment for the
 * same user) hit the UNIQUE constraints and are logged as no-ops.
 */
export async function maybeGrantAffiliateCommission(
  user: CommissionUser,
  payment: CommissionPayment
): Promise<void> {
  try {
    if (!user.referred_by_affiliate_id) return;
    if (!payment.id) return;
    if (!isFirstSubscriptionPayment(payment, user)) return;

    const amount = payment.subtotal ?? payment.settlement_amount;
    if (typeof amount !== 'number' || !(amount > 0)) return;
    const paymentAmountCents = Math.round(amount * 100);

    const { error } = await supabaseAdmin.from('affiliate_commissions').insert({
      affiliate_id: user.referred_by_affiliate_id,
      user_id: user.id,
      whop_payment_id: payment.id,
      payment_amount_cents: paymentAmountCents,
      commission_cents: commissionCents(paymentAmountCents),
      currency: payment.currency ?? 'usd',
    });

    if (error) {
      if (/duplicate key|unique/i.test(error.message)) {
        console.log('[affiliates] commission already recorded, skipping', {
          userId: user.id,
          whopPaymentId: payment.id,
        });
        return;
      }
      console.error('[affiliates] failed to record commission', {
        userId: user.id,
        whopPaymentId: payment.id,
        message: error.message,
      });
      return;
    }

    console.log('[affiliates] commission recorded', {
      affiliateId: user.referred_by_affiliate_id,
      userId: user.id,
      whopPaymentId: payment.id,
      commissionCents: commissionCents(paymentAmountCents),
    });
  } catch (err) {
    console.error('[affiliates] commission handling threw', {
      userId: user.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Stamp first-touch attribution on a user row. Set-once: only writes when
 * referred_by_affiliate_id is still null, so a later click on a different
 * affiliate link never reassigns the user. Never throws.
 */
export async function attributeSignupToAffiliate(
  authUserId: string,
  refCode: string
): Promise<void> {
  try {
    const code = refCode.toLowerCase().trim();
    if (!/^[a-z0-9-]{2,40}$/.test(code)) return;

    const { data: affiliate } = (await supabaseAdmin
      .from('affiliates')
      .select('id')
      .eq('code', code)
      .maybeSingle()) as unknown as { data: { id: string } | null };
    if (!affiliate) return;

    await supabaseAdmin
      .from('users')
      .update({ referred_by_affiliate_id: affiliate.id })
      .eq('auth_user_id', authUserId)
      .is('referred_by_affiliate_id', null);
  } catch (err) {
    console.error('[affiliates] attribution failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
