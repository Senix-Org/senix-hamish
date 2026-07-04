import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tree-sitter and its language grammars ship native (.node) bindings that
  // can't be bundled. Mark them as external so Next.js requires them at
  // runtime from node_modules where a real Node.js runtime exists (next dev,
  // the standalone worker). On Cloudflare Workers native addons cannot load
  // at all; features/ai-engine/parser.ts guards the require and degrades to
  // no symbol detail there.
  serverExternalPackages: [
    'tree-sitter',
    'tree-sitter-javascript',
    'tree-sitter-typescript',
    'tree-sitter-python',
  ],
  // The Whop embedded checkout ships modern ESM and web-component glue that
  // needs to go through the app's transpile pipeline to load in the browser.
  transpilePackages: ['@whop/checkout'],
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
