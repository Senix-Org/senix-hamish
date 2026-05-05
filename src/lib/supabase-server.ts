import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side, user-context Supabase client. Reads the session from the
 * request cookies and writes refreshed cookies back via Next's cookies()
 * store. Subject to RLS — use this for anything that should be scoped to
 * the signed-in user. For RLS-bypassing operations use `supabaseAdmin`
 * from `@/lib/supabase`.
 *
 * Safe to call inside server components, route handlers, and server
 * actions. Cookie writes from a server component are silently ignored by
 * Next (no mutable response there); the middleware refreshes cookies on
 * every request, so that's fine.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — cookies are immutable here.
            // The middleware refreshes the session on every request, so
            // safe to swallow.
          }
        },
      },
    }
  );
}
