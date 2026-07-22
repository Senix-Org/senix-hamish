import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { currentAppUserId, formatTokenDate, mintMcpToken } from '@features/auth/mcp-tokens';
import { MAX_TOKENS_PER_USER } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/mcp/token
 *
 * Creates an MCP personal access token for the signed-in user. Called by
 * the dashboard "Connect your IDE" flow. The request body carries an
 * optional `name`; when it is empty we fall back to "IDE on <date>". Only
 * the SHA-256 hash is stored. The plaintext token is returned exactly
 * once in this response and can never be retrieved again.
 */

const MAX_NAME_LEN = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await currentAppUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  // Count only live tokens: the tokens page soft-revokes (sets revoked_at)
  // rather than deleting, and revoked tokens must free their slot.
  const { count, error: countError } = await supabaseAdmin
    .from('mcp_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (count !== null && count >= MAX_TOKENS_PER_USER) {
    return NextResponse.json(
      {
        error: `Maximum of ${MAX_TOKENS_PER_USER} tokens per user allowed. Please revoke an existing token first.`,
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const rawName =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).name === 'string'
      ? ((body as Record<string, unknown>).name as string)
      : '';

  // An empty name gets a sensible default so every token is identifiable.
  let name = rawName.trim().slice(0, MAX_NAME_LEN);
  if (!name) {
    name = `IDE on ${formatTokenDate(new Date())}`;
  }

  const { token, tokenHash } = mintMcpToken();

  const { error } = await supabaseAdmin.from('mcp_tokens').insert({
    user_id: userId,
    name,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token, name });
}
