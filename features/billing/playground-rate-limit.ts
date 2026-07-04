import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';

/**
 * Token-based rate limiting for the anonymous playground.
 *
 * The playground has no auth for anonymous users, so abuse is bounded by
 * IP: 10,000 LLM tokens per IP per rolling 24h window. Counters live in
 * Supabase (see migration 009) because serverless instances cannot share an
 * in-memory counter. Raw IPs are never stored, only their SHA-256 hash.
 *
 * Authenticated playground usage does NOT go through here — it counts
 * against the user's monthly token budget via plan-limits instead.
 */

export const PLAYGROUND_DAILY_TOKEN_LIMIT = 10_000;

export type TokenBudgetResult = {
  allowed: boolean;
  used: number;
};

/**
 * Client IP for rate limiting. CF-Connecting-IP is set by Cloudflare itself
 * on every request that traverses its edge and cannot be spoofed by the
 * caller, so it is authoritative. x-real-ip and x-forwarded-for are
 * best-effort fallbacks for local dev and non-Cloudflare deployments only;
 * x-forwarded-for is client-controllable and is deliberately last.
 */
export function clientIp(req: NextRequest): string {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

/** ISO timestamp truncated to the start of the current UTC day (24h window). */
function currentWindowStart(): string {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString();
}

function hash(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Pre-check: report whether the IP is still under its daily token budget.
 * Reads the current window total. Fails closed (throws) if the counter is
 * unreachable, so a database outage cannot become an unmetered path to the
 * LLM.
 */
export async function checkPlaygroundTokenBudget(ip: string): Promise<TokenBudgetResult> {
  const { data, error } = await supabaseAdmin.rpc('get_playground_token_usage', {
    p_ip_hash: hash(ip),
    p_window_start: currentWindowStart(),
  });

  if (error || typeof data !== 'number') {
    throw new Error(
      `playground token budget lookup failed: ${error?.message ?? 'no count returned'}`
    );
  }

  return { allowed: data < PLAYGROUND_DAILY_TOKEN_LIMIT, used: data };
}

/**
 * Record actual tokens used by an anonymous playground request against the
 * caller's IP for the current 24h window. Atomic in the database. Returns
 * the new running total.
 */
export async function recordPlaygroundTokens(ip: string, tokens: number): Promise<number> {
  const amount = Math.max(0, Math.round(tokens));
  const { data, error } = await supabaseAdmin.rpc('increment_playground_token_usage', {
    p_ip_hash: hash(ip),
    p_window_start: currentWindowStart(),
    p_tokens: amount,
  });

  if (error || typeof data !== 'number') {
    throw new Error(
      `playground token usage increment failed: ${error?.message ?? 'no count returned'}`
    );
  }

  return data;
}
