import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tree-sitter and its language grammars ship native (.node) bindings that
  // can't be bundled. Mark them as external so Next.js requires them at
  // runtime from node_modules. Required for the /api/internal/analyze-pr
  // serverless route which transitively imports the parser.
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
