import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Senix middleware:
 *  - /internal/* is gated by Basic Auth (team-only pages).
 *  - Everything else gets a Supabase session-refresh pass: we read the
 *    auth cookies, hand them to a server-context client, call
 *    `auth.getUser()` to refresh the session, and propagate any rotated
 *    cookies onto the response. We never block on the auth result here —
 *    page-level guards (`/dashboard/layout.tsx`, `/login`, `/setup`) own
 *    the redirect logic.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.nextUrl.pathname.startsWith('/internal')) {
    return enforceInternalBasicAuth(req);
  }

  return refreshSupabaseSession(req);
}

/**
 * Basic Auth gate for /internal/*. Fails CLOSED: if `INTERNAL_PASSWORD`
 * is unset, every request is denied rather than silently allowed. A
 * misconfiguration must never expose internal tooling to the public.
 */
export function enforceInternalBasicAuth(req: NextRequest): NextResponse {
  const password = process.env.INTERNAL_PASSWORD;
  if (!password) {
    return new NextResponse('Internal access is not configured.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Internal"' },
    });
  }

  const auth = req.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString();
      // Username-agnostic, matching verifyInternalAuth in
      // src/lib/internal-auth.ts: only the password (everything after the
      // first colon) is compared, in constant time.
      const colon = decoded.indexOf(':');
      const providedPassword = colon === -1 ? '' : decoded.slice(colon + 1);
      if (timingSafeStringEqual(providedPassword, password)) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Internal"' },
  });
}

/**
 * Constant-time string comparison, mirroring what src/lib/internal-auth.ts
 * does for the /api/internal/* routes with node:crypto's timingSafeEqual.
 *
 * node:crypto is NOT used here: middleware compiles against the Edge
 * Runtime and `next build` flags the import as unsupported (verified). On
 * Cloudflare Workers the WebCrypto extension crypto.subtle.timingSafeEqual
 * is available and used; in runtimes without it (next dev on Node, where
 * the extension does not exist) a constant-time XOR loop covers the same
 * property. A length mismatch returns early; the length of the secret is
 * not considered sensitive here.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;

  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean;
  };
  if (typeof subtle.timingSafeEqual === 'function') {
    return subtle.timingSafeEqual(bufA, bufB);
  }

  let diff = 0;
  for (let i = 0; i < bufA.length; i += 1) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

/**
 * Refresh the Supabase session cookie for non-internal paths.
 * Implements the standard @supabase/ssr middleware pattern: cookies are
 * mirrored onto both the incoming request and the outgoing response so
 * downstream handlers and the browser see a consistent state.
 */
async function refreshSupabaseSession(req: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            req.cookies.set(name, value);
          }
          response = NextResponse.next({ request: req });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /**
     * Run on every path EXCEPT static assets, image optimisation, and
     * favicon. The Basic Auth branch handles /internal/*; the
     * session-refresh branch handles everything else (landing, /login,
     * /setup, /dashboard/*, /auth/callback).
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
