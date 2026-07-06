import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

/**
 * Shared auth for the /api/internal/* routes.
 *
 * Fails CLOSED: if neither CRON_SECRET nor INTERNAL_PASSWORD is configured,
 * every request is rejected. A misconfigured environment must never expose
 * internal endpoints (the reconcile route can mutate billing state for every
 * user). This matches the fail-closed behavior of enforceInternalBasicAuth
 * in src/middleware.ts, which gates the /internal/* pages.
 *
 * All secret comparisons use crypto.timingSafeEqual (available on Cloudflare
 * Workers under nodejs_compat) so the comparison time does not leak how many
 * leading characters of a guess were correct. timingSafeEqual requires equal
 * lengths, so a length check guards each call; the length of the secret is
 * not considered sensitive here.
 *
 * Accepted credentials:
 * 1. `Authorization: Bearer <CRON_SECRET>` — used by the scheduled GitHub
 *    Actions reconciliation workflow.
 * 2. `Authorization: Basic <base64(user:INTERNAL_PASSWORD)>` — used by
 *    operators. The username is ignored, matching the /internal/* middleware,
 *    so credentials cached by the browser for those pages also work against
 *    these API routes. Only the password is compared, in constant time.
 */
export function verifyInternalAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const internalPassword = process.env.INTERNAL_PASSWORD;

  if (!authHeader) return false;

  // Try CRON_SECRET bearer token first.
  if (cronSecret) {
    const expected = `Bearer ${cronSecret}`;
    if (timingSafeStringEqual(authHeader, expected)) return true;
  }

  // Try INTERNAL_PASSWORD basic auth (username-agnostic, like middleware).
  if (internalPassword && authHeader.startsWith('Basic ')) {
    let decoded: string;
    try {
      decoded = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
    } catch {
      return false;
    }
    const colon = decoded.indexOf(':');
    const providedPassword = colon === -1 ? '' : decoded.slice(colon + 1);
    if (timingSafeStringEqual(providedPassword, internalPassword)) return true;
  }

  // If neither secret is set (or nothing matched), FAIL CLOSED.
  return false;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Standard 401 for the internal routes, with the Basic challenge. */
export function internalUnauthorized(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Internal"' },
  });
}
