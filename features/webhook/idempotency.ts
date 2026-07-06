import { supabaseAdmin } from '@features/shared/supabase';

/**
 * Idempotency guard for GitHub webhook deliveries.
 *
 * GitHub retries deliveries (network blips, slow responses), and each retry
 * carries the same `x-github-delivery` id. The old guard was a SELECT for
 * `processed = true` followed by processing and a final UPDATE — two
 * concurrent retries could both see processed = false and both proceed.
 *
 * The claim is now the INSERT itself: `github_delivery_id` is UNIQUE
 * (migration 013), so exactly one concurrent request inserts the row and
 * owns processing; every other request hits a unique violation (Postgres
 * error 23505) and skips. This is the INSERT ... ON CONFLICT DO NOTHING
 * pattern expressed through the Supabase client, which surfaces the
 * conflict as error code 23505 instead of RETURNING no row.
 */

/** Postgres unique_violation — another request already claimed this id. */
const UNIQUE_VIOLATION = '23505';

export type DeliveryClaimInput = {
  deliveryId: string;
  eventType: string;
  action: string | null;
  payload: unknown;
};

export type DeliveryClaim = 'claimed' | 'duplicate';

/**
 * Atomically claim a delivery id by inserting its webhook_events row.
 * Returns 'claimed' when this request owns processing, 'duplicate' when a
 * row for the id already exists (a concurrent or earlier delivery owns it).
 *
 * Fails OPEN on any other insert error: a transient DB failure should not
 * silently drop a real webhook. Worst case we re-process, which the
 * downstream comment-upsert and queue-claim guards already make safe.
 */
export async function claimDelivery(input: DeliveryClaimInput): Promise<DeliveryClaim> {
  const { data, error } = (await supabaseAdmin
    .from('webhook_events')
    .insert({
      github_delivery_id: input.deliveryId,
      event_type: input.eventType,
      action: input.action,
      payload: input.payload,
      signature_valid: true,
      processed: false,
    })
    .select('id')
    .single()) as unknown as {
    data: { id: string } | null;
    error: { code?: string; message: string } | null;
  };

  if (data) return 'claimed';

  if (error?.code === UNIQUE_VIOLATION) {
    return 'duplicate';
  }

  console.warn(
    `[webhook idempotency] claim insert failed for ${input.deliveryId}: ${error?.message ?? 'no row returned'}`
  );
  return 'claimed';
}

/**
 * Mark a claimed delivery as fully processed. Best-effort bookkeeping: the
 * claim row already prevents duplicates whether or not this update lands.
 */
export async function markDeliveryProcessed(deliveryId: string): Promise<void> {
  await supabaseAdmin
    .from('webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('github_delivery_id', deliveryId);
}
