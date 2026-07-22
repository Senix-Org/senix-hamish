'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

/**
 * Ties the current anonymous PostHog session to the signed-in user. Rendered
 * inside the authenticated dashboard shell, so it runs once auth is resolved
 * and the internal user row is known.
 *
 * distinctId is the internal users.id (a stable UUID we own for the account's
 * life), NOT the GitHub user id — see Phase 3 notes. The first identify() with
 * that id merges the prior anonymous events into the real profile; posthog-js
 * then persists the distinct id, so we guard on it to fire identify() at most
 * once per login rather than on every navigation (repeated calls are harmless
 * but wasteful). Logout calls posthog.reset() (see SignOutButton) so the next
 * anonymous session on this browser is not attributed to this user.
 */
export default function PostHogIdentify({
  distinctId,
  email,
  plan,
  createdAt,
}: {
  distinctId: string;
  email: string | null;
  plan: string | null;
  createdAt: string | null;
}): null {
  useEffect(() => {
    if (!distinctId) return;
    // posthog.__loaded is set after init completes. Without this guard,
    // identify() can run against an uninitialized library and do nothing.
    if (!(posthog as unknown as { __loaded?: boolean }).__loaded) return;
    // Skip if the user is already identified as this distinct id.
    if (posthog.get_distinct_id() === distinctId) return;

    posthog.identify(distinctId, {
      email: email ?? undefined,
      plan: plan ?? undefined,
      created_at: createdAt ?? undefined,
    });
  }, [distinctId, email, plan, createdAt]);

  return null;
}
