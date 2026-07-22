import { supabaseAdmin } from '@features/shared/supabase';
import { CREDIT_PACK_DETAILS, type CreditPackName } from '@features/billing/whop';

export { CREDIT_PACK_DETAILS, type CreditPackName } from '@features/billing/whop';

export type CreditPackRow = {
  id: string;
  pack: CreditPackName;
  credits: number;
  credits_used: number;
  expires_at: string;
  created_at: string;
};

export type CreditBalance = {
  /** Sum of remaining credits across all non-expired packs. */
  totalCredits: number;
  /** Individual active packs, oldest first. */
  packs: CreditPackRow[];
};

/**
 * Sum a user's remaining credit-pack balance. Oldest-expiring packs are listed
 * first so the dashboard can hint which pack will be used next. Mirrors the
 * ordering used by the consume_tokens RPC.
 */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const { data, error } = (await supabaseAdmin
    .from('credit_packs')
    .select('id, pack, credits, credits_used, expires_at, created_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .order('created_at', { ascending: true })) as unknown as {
    data: CreditPackRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to load credit balance: ${error.message}`);
  }

  const packs = (data ?? []).map((row) => ({
    ...row,
    credits: Number(row.credits),
    credits_used: Number(row.credits_used),
  }));
  const totalCredits = packs.reduce((sum, row) => sum + (row.credits - row.credits_used), 0);

  return { totalCredits, packs };
}

/**
 * Format a credit count for display, e.g. 200000 -> "200K".
 */
export function formatCredits(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString();
}
