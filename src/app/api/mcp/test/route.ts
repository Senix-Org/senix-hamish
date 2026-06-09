import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A token is considered "connected" if the IDE called the MCP endpoint
 *  within this window. The MCP route bumps `last_used_at` on every real
 *  tool call, so recent usage proves the IDE actually reached us. */
const CONNECTED_WINDOW_MS = 5 * 60 * 1000;

type TestStatus = 'connected' | 'token_valid' | 'invalid';

/**
 * GET /api/mcp/test?token=sk_mcp_...
 *
 * Connectivity check for the Connect IDE flow's "Test connection" button.
 * Unlike a bare token-exists check, this reports whether the IDE has
 * actually reached the MCP endpoint recently:
 *   - `invalid`      — token is missing, unknown, or revoked.
 *   - `token_valid`  — token works but the IDE has never called, or last
 *                      called more than five minutes ago.
 *   - `connected`    — the IDE called within the last five minutes.
 * Does no analysis and burns no LLM cost. Responses are never cached.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  const noStore = { headers: { 'Cache-Control': 'no-store' } };

  const body = (status: TestStatus, extra: Record<string, unknown> = {}) => ({
    status,
    connected: status === 'connected',
    ...extra,
  });

  if (!token) {
    return NextResponse.json(body('invalid', { error: 'Missing token.' }), {
      status: 400,
      ...noStore,
    });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { data, error } = (await supabaseAdmin
    .from('mcp_tokens')
    .select('id, last_used_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()) as unknown as {
    data: { id: string; last_used_at: string | null; revoked_at: string | null } | null;
    error: { message: string } | null;
  };

  if (error) {
    return NextResponse.json(
      body('invalid', { error: 'Could not verify the token right now. Try again.' }),
      { status: 500, ...noStore }
    );
  }

  if (!data || data.revoked_at) {
    return NextResponse.json(
      body('invalid', { error: 'This token is invalid or has been revoked.' }),
      { status: 401, ...noStore }
    );
  }

  const lastUsedMs = data.last_used_at ? new Date(data.last_used_at).getTime() : null;
  const recentlyUsed =
    lastUsedMs !== null && !Number.isNaN(lastUsedMs) && Date.now() - lastUsedMs <= CONNECTED_WINDOW_MS;

  if (recentlyUsed) {
    return NextResponse.json(body('connected', { lastUsedAt: data.last_used_at }), {
      status: 200,
      ...noStore,
    });
  }

  return NextResponse.json(
    body('token_valid', {
      lastUsedAt: data.last_used_at,
      message: data.last_used_at
        ? 'Token valid, but no IDE activity in the last 5 minutes.'
        : 'Token valid, but no IDE has connected with it yet.',
    }),
    { status: 200, ...noStore }
  );
}
