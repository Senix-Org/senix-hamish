import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Per-user fixed-window rate limiter for the MCP endpoint.
 *
 * The monthly token budget (`plan-limits`) bounds total LLM cost, but a
 * buggy or compromised IDE can fire dozens of `tools/call` requests per
 * second — each costing real money — before the monthly cap catches up.
 * This short-window limiter caps request frequency independently.
 *
 * Uses Upstash Ratelimit (built on Upstash Redis, already a project
 * dependency) keyed on the authenticated user's ID. Serverless instances
 * cannot share an in-memory counter, so Redis is the right store. The
 * library gives us atomic fixed-window counting, analytics, and an
 * ephemeral in-memory cache so blocked requests do not always hit Redis.
 *
 * Fails open: if Redis is unreachable, the request is allowed through
 * (the monthly budget gate still protects cost). Rate limiting is a
 * defence-in-depth measure, not the primary billing control.
 */

/** Max MCP tool calls per user per 60-second window. */
const MCP_RATE_LIMIT = 10;
const WINDOW_SECONDS = 60;

let ratelimitInstance: Ratelimit | null = null;

function ratelimit(): Ratelimit {
  if (!ratelimitInstance) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
    }
    ratelimitInstance = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.fixedWindow(MCP_RATE_LIMIT, `${WINDOW_SECONDS} s`),
      analytics: true,
      prefix: 'senix:mcp:rate',
      // Allow the request through if Redis does not respond in time.
      timeout: 2000,
    });
  }
  return ratelimitInstance;
}

export type McpRateLimitResult = {
  allowed: boolean;
  /** Approximate remaining calls in the current window. */
  remaining: number;
  /** Absolute epoch SECONDS at which the current window resets. */
  resetsAt: number;
  /** Whole seconds until the window resets; safe for user-facing messages. */
  retryAfterSeconds: number;
};

/**
 * Increment and check the per-user request counter. Returns whether the
 * request is allowed and how many requests remain in the window.
 *
 * Uses Upstash Ratelimit's atomic fixed-window implementation.
 */
export async function checkMcpRateLimit(userId: string): Promise<McpRateLimitResult> {
  try {
    const result = await ratelimit().limit(userId);
    // result.reset is an ABSOLUTE Unix timestamp in milliseconds (per the
    // @upstash/ratelimit RatelimitResponse type: "Unix timestamp in
    // milliseconds when the limits are reset"), not a relative offset. The
    // old code added it to Date.now()/1000, producing a nonsense far-future
    // "try again in N seconds" value.
    const resetsAt = Math.ceil(result.reset / 1000);
    const retryAfterSeconds = Math.max(0, resetsAt - Math.floor(Date.now() / 1000));
    return {
      allowed: result.success,
      remaining: Math.max(0, result.remaining),
      resetsAt,
      retryAfterSeconds,
    };
  } catch {
    // Fail open: Redis down should not block legitimate users.
    return {
      allowed: true,
      remaining: MCP_RATE_LIMIT,
      resetsAt: Math.floor(Date.now() / 1000) + WINDOW_SECONDS,
      retryAfterSeconds: WINDOW_SECONDS,
    };
  }
}
