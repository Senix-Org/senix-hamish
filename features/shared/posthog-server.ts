/**
 * Server-side PostHog capture for Cloudflare Workers.
 *
 * Implemented as a direct POST to PostHog's /capture/ HTTP endpoint via the
 * runtime's native fetch — deliberately NO posthog-node SDK. posthog-node
 * pulls in node:fs, which cannot be bundled for the browser and, more to the
 * point here, is loaded by the wrangler-bundled Workflow entry (worker.ts),
 * where the previous `server-only` guard threw at import and crashed the
 * whole analysis pipeline (2026-07-18 incident, see CLAUDE.md). fetch has
 * none of those problems: it exists in every Workers context, needs no SDK,
 * and this module contains nothing client-unsafe, so no server-only guard is
 * needed and no import can throw.
 *
 * captureServerEvent NEVER throws and NEVER rejects — analytics must not be
 * able to fail a webhook, a review, or a payment. Background callers (webhook
 * after(), Workflow steps, internal cron routes) may `await` it so the POST
 * completes before the invocation ends; hot-path callers (the token gate)
 * fire-and-forget with `void`.
 */

const CAPTURE_TIMEOUT_MS = 3000;

export async function captureServerEvent(input: {
  distinctId: string | null | undefined;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  try {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // No key (unset) or no identified user → skip. Every server event must
    // attach to the internal user UUID from Phase 3, never an anonymous id.
    if (!key || !input.distinctId) return;

    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    // Drop undefined-valued properties so they do not clutter the event.
    const properties = input.properties
      ? Object.fromEntries(Object.entries(input.properties).filter(([, v]) => v !== undefined))
      : undefined;

    await fetch(`${host.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: input.event,
        distinct_id: input.distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
  } catch {
    // Swallow everything: a PostHog outage, timeout, or slow network must
    // never surface to the calling business logic.
  }
}
