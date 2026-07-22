import type { NextConfig } from "next";

const nextConfig = {
  // The Whop embedded checkout ships modern ESM and web-component glue that
  // needs to go through the app's transpile pipeline to load in the browser.
  transpilePackages: ['@whop/checkout'],
  // Explicitly inject the client-side PostHog instrumentation file before
  // hydration. Next.js 16 + opennextjs/cloudflare do not auto-load
  // instrumentation-client.ts by default; without this, pageview/autocapture
  // never starts and the dashboard appears to send no analytics.
  instrumentationClientInject: ['./src/instrumentation-client.ts'],
} as NextConfig;

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
