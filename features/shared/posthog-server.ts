// Guard: importing this module from a client component fails the build with a
// clear message rather than the cryptic "node:fs" chunking error posthog-node
// produces when webpack tries to bundle it for the browser.
import 'server-only';
import { PostHog } from 'posthog-node';

/**
 * Server-side PostHog capture, safe for Cloudflare Workers.
 *
 * Two hazards this file is built around, both learned the hard way this week:
 *
 * 1. NO MODULE-SCOPE CONSTRUCTION. The client is created lazily on first use,
 *    not at import time — env vars do not exist during Worker __init (same
 *    lesson as the Supabase lazy Proxy). The cached client is fine to reuse
 *    across invocations; it holds only config, no per-request state.
 *
 * 2. NO BACKGROUND FLUSH / NO shutdown() HANG. posthog-node's default capture
 *    batches and flushes on a background timer, which a Worker invocation can
 *    end before it fires (event lost) — and awaiting shutdown() is an unbounded
 *    network wait, the exact waitUntil-30s trap. Instead we use captureImmediate
 *    with flushAt:1/flushInterval:0: each event is one bounded HTTP POST that
 *    resolves inline, no queue to strand, no shutdown to hang.
 *
 * captureServerEvent NEVER throws and NEVER rejects — analytics must not be
 * able to fail a webhook, a review, or a payment. Callers already inside an
 * async background context (webhook after(), Workflow steps, internal cron
 * routes) may `await` it so the POST completes before the invocation ends;
 * hot-path callers (e.g. the token gate) fire-and-forget with `void`.
 */

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServerEvent(input: {
  distinctId: string | null | undefined;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  try {
    const c = getClient();
    // No client (key absent) or no identified user → skip. Every server event
    // must attach to the internal user UUID from Phase 3, never an anonymous id.
    if (!c || !input.distinctId) return;

    // Drop undefined-valued properties so they do not clutter the event.
    const properties = input.properties
      ? Object.fromEntries(Object.entries(input.properties).filter(([, v]) => v !== undefined))
      : undefined;

    await c.captureImmediate({
      distinctId: input.distinctId,
      event: input.event,
      properties,
    });
  } catch {
    // Swallow everything: a PostHog outage or slow network must never surface
    // to the calling business logic.
  }
}
