import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { supabaseAdmin } from '@features/shared/supabase';
import { AFFILIATE_COOKIE, attributeSignupToAffiliate } from '@features/billing/affiliates';

export const dynamic = 'force-dynamic';

/**
 * OAuth callback handler. Supabase redirects the user here after they
 * authorise the GitHub App; we exchange the `code` for a session, set
 * the cookies, then bounce them onward. Honours an optional `next`
 * query param so the /setup flow can resume mid-install.
 *
 * After a successful session exchange we ensure a `users` row exists
 * for this auth user. Previously this only happened in `/setup`, so
 * users who signed in without first installing the GitHub App had no
 * `users` row and the RLS-gated dashboard queries returned nothing.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  // Ensure the public `users` row exists for this auth user so that
  // RLS policies (which chain through `users.auth_user_id`) work on
  // the very first login, even before the GitHub App is installed.
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const meta = authData.user.user_metadata ?? {};
      const githubUsername =
        (meta.user_name as string | undefined) ??
        (meta.preferred_username as string | undefined) ??
        null;
      const providerIdRaw = (meta.provider_id as string | number | undefined) ?? null;
      const githubUserId =
        typeof providerIdRaw === 'string'
          ? Number(providerIdRaw)
          : (providerIdRaw as number | null);

      await supabaseAdmin.from('users').upsert(
        {
          auth_user_id: authData.user.id,
          github_username: githubUsername,
          github_user_id: githubUserId,
          email: authData.user.email ?? null,
        },
        { onConflict: 'auth_user_id' }
      );

      // Affiliate attribution: if the visitor arrived via senix.dev/yt/{code}
      // the cookie survives the OAuth round trip; stamp first-touch
      // attribution (set-once, inside the helper) now that the row exists.
      // Best-effort: attribution must never affect login.
      const refCode = req.cookies.get(AFFILIATE_COOKIE)?.value;
      if (refCode) {
        await attributeSignupToAffiliate(authData.user.id, refCode);
      }
    }
  } catch {
    // Non-fatal — the user can still reach the dashboard; the row
    // will be created on the next visit through /setup if needed.
  }

  return NextResponse.redirect(`${origin}${next}`);
}
