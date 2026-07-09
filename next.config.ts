import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Whop embedded checkout ships modern ESM and web-component glue that
  // needs to go through the app's transpile pipeline to load in the browser.
  transpilePackages: ['@whop/checkout'],
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
