'use server';

import { createHash, randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { supabaseAdmin } from '@features/shared/supabase';

const TOKEN_PREFIX = 'sk_mcp_';
const MIN_NAME_LEN = 2;
const MAX_NAME_LEN = 60;

type GenerateResult = { ok: true; token: string } | { ok: false; error: string };
type RevokeResult = { ok: true } | { ok: false; error: string };

type AppUserRow = { id: string };
type TokenOwnerRow = { id: string; user_id: string; revoked_at: string | null };

/** Resolve the app `users.id` for the current session, or null. */
async function currentAppUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data: appUser } = (await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()) as unknown as { data: AppUserRow | null };

  return appUser?.id ?? null;
}

/**
 * Generate a new MCP personal access token. The plaintext token is
 * returned to the caller exactly once for display — only its SHA-256
 * hash is persisted. The MCP route hashes presented tokens the same way
 * to authenticate IDE requests.
 */
export async function generateMcpToken(name: string): Promise<GenerateResult> {
  const trimmed = name?.trim() ?? '';
  if (trimmed.length < MIN_NAME_LEN) {
    return { ok: false, error: `Name must be at least ${MIN_NAME_LEN} characters.` };
  }
  if (trimmed.length > MAX_NAME_LEN) {
    return { ok: false, error: `Name must be ${MAX_NAME_LEN} characters or fewer.` };
  }

  const userId = await currentAppUserId();
  if (!userId) {
    return { ok: false, error: 'Not signed in.' };
  }

  const token = TOKEN_PREFIX + randomBytes(16).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { error } = await supabaseAdmin.from('mcp_tokens').insert({
    user_id: userId,
    name: trimmed,
    token_hash: tokenHash,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/tokens');
  return { ok: true, token };
}

/**
 * Revoke an MCP token by id. Soft-revokes (sets `revoked_at`) rather than
 * deleting, so the row stays as an audit trail. Verifies the token
 * belongs to the signed-in user first.
 */
export async function revokeMcpToken(id: string): Promise<RevokeResult> {
  const userId = await currentAppUserId();
  if (!userId) {
    return { ok: false, error: 'Not signed in.' };
  }

  const { data: token } = (await supabaseAdmin
    .from('mcp_tokens')
    .select('id, user_id, revoked_at')
    .eq('id', id)
    .maybeSingle()) as unknown as { data: TokenOwnerRow | null };

  if (!token || token.user_id !== userId) {
    return { ok: false, error: 'Token not found.' };
  }
  if (token.revoked_at) {
    return { ok: true };
  }

  const { error } = await supabaseAdmin
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', token.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/tokens');
  return { ok: true };
}
