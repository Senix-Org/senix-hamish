import posthog from 'posthog-js';

/**
 * Client-side PostHog init (Phase 2 analytics: pageviews + autocapture only;
 * nothing server-side). Next.js runs this file once in the browser before the
 * app hydrates — the current recommended integration, no Provider wrapper.
 *
 * NEXT_PUBLIC_POSTHOG_KEY/HOST are inlined at BUILD time by the GitHub
 * Actions deploy (see .github/workflows/deploy.yml); they are not Cloudflare
 * Worker secrets, which the build cannot see. The key is public by design.
 *
 * capture_pageview: 'history_change' covers App Router client-side
 * navigations (pushState/replaceState), which never fire a traditional page
 * load; the initial load is captured as a pageview too.
 */
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// instrumentation-client.ts runs in the browser before hydration. Guard
// against non-browser contexts (e.g. test environments or unexpected Node
// execution) and skip silently when no key is configured.
if (typeof window !== 'undefined' && posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    // Ensure the distinct id is persisted across sessions; this also makes
    // PostHogIdentify's get_distinct_id guard reliable after init.
    persistence: 'localStorage+cookie',
  });
} else if (typeof window !== 'undefined' && !posthogKey && process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.warn('[posthog] NEXT_PUBLIC_POSTHOG_KEY is not set; client analytics are disabled.');
}
