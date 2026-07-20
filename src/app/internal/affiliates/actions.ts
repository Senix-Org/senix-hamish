'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@features/shared/supabase';

/**
 * Admin mutations for the affiliates page. These run server-side with the
 * service role; the page (and therefore these actions) sits behind the
 * /internal Basic Auth gate in middleware. Volume is tiny (manual payouts),
 * so no optimistic UI — just mutate and revalidate.
 */

export async function createAffiliate(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '').toLowerCase().trim();
  const name = String(formData.get('name') ?? '').trim();
  const payoutContact = String(formData.get('payout_contact') ?? '').trim();

  if (!/^[a-z0-9-]{2,40}$/.test(code) || !name) return;

  const { error } = await supabaseAdmin.from('affiliates').insert({
    code,
    name,
    payout_contact: payoutContact || null,
  });
  if (error) {
    console.error('[internal/affiliates] create failed', { code, message: error.message });
  }
  revalidatePath('/internal/affiliates');
}

export async function setCommissionStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('commission_id') ?? '');
  const next = String(formData.get('next_status') ?? '');
  if (!id || (next !== 'paid' && next !== 'unpaid')) return;

  const { error } = await supabaseAdmin
    .from('affiliate_commissions')
    .update({
      status: next,
      paid_at: next === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) {
    console.error('[internal/affiliates] status update failed', { id, message: error.message });
  }
  revalidatePath('/internal/affiliates');
}
