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

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: 'history_change',
    capture_pageleave: true,
  });
}
