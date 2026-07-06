import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { currentAppUserId, formatTokenDate, mintMcpToken } from '@features/auth/mcp-tokens';

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
