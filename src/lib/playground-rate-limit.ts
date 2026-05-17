import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * IP-based rate limiting for the public playground.
 *
 * The playground has no auth, so abuse is bounded by IP: 5 requests per
 * IP per hour. The counter lives in Supabase (see migration 007) because
 * serverless instances cannot share an in-memory counter. Raw IPs are
 * never stored, only their SHA-256 hash.
 */

export const PLAYGROUND_HOURLY_LIMIT = 5;

export type RateLimitResult = {
  allowed: boolean;
  count: number;
};

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** ISO timestamp truncated to the start of the current UTC hour. */
function currentWindowStart(): string {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now.toISOString();
}

/**
 * Count this request against the caller's IP for the current hour and
 * report whether it is within the limit. The increment is atomic in the
 * database, so concurrent requests cannot both pass at the boundary.
 *
 * Throws if the counter cannot be reached. The caller treats that as a
 * server error (fail closed) rather than letting the request through, so
 * a database outage cannot become an unmetered path to the LLM.
 */
export async function checkPlaygroundRateLimit(ip: string): Promise<RateLimitResult> {
  const ipHash = createHash('sha256').update(ip).digest('hex');

  const { data, error } = await supabaseAdmin.rpc('increment_playground_rate_limit', {
    p_ip_hash: ipHash,
    p_window_start: currentWindowStart(),
  });

  if (error || typeof data !== 'number') {
    throw new Error(`playground rate limit lookup failed: ${error?.message ?? 'no count returned'}`);
  }

  return { allowed: data <= PLAYGROUND_HOURLY_LIMIT, count: data };
}
