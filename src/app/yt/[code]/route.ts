import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import {
  AFFILIATE_COOKIE,
  AFFILIATE_COOKIE_MAX_AGE_SECONDS,
} from '@features/billing/affiliates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Affiliate short link: senix.dev/yt/{code} -> landing page, dropping a
 * 30-day first-party cookie that /auth/callback reads at signup to stamp
 * attribution. sameSite=lax survives the GitHub OAuth round trip (top-level
 * GET navigation back to our domain sends it). An unknown code still
 * redirects cleanly, just without setting the cookie, so a dead link can
 * never break the landing page. Nothing here touches the auth flow itself.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code: raw } = await ctx.params;
  const code = (raw ?? '').toLowerCase().trim();

  const response = NextResponse.redirect(new URL('/', req.nextUrl.origin));

  if (/^[a-z0-9-]{2,40}$/.test(code)) {
    // Only set the cookie for codes that actually exist, so random /yt/xyz
    // hits do not plant junk attribution cookies.
    const { data: affiliate } = await supabaseAdmin
      .from('affiliates')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (affiliate) {
      response.cookies.set(AFFILIATE_COOKIE, code, {
        maxAge: AFFILIATE_COOKIE_MAX_AGE_SECONDS,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
      });
    }
  }

  return response;
}
