import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Parsing now uses web-tree-sitter (WASM, loaded at runtime from
  // public/wasm), so no native tree-sitter packages need externalizing.
  //
  // The Whop embedded checkout ships modern ESM and web-component glue that
  // needs to go through the app's transpile pipeline to load in the browser.
  transpilePackages: ['@whop/checkout'],
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
