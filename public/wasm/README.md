# tree-sitter WASM binaries

These are the WebAssembly binaries the structural diff parser
(features/ai-engine/parser.ts) loads at runtime. They are static assets:
served next to the app, read from disk in Node runtimes, and NOT part of
the Cloudflare Worker script bundle.

Sources (vendored, update by re-downloading and bumping this list):

1. tree-sitter.wasm — the web-tree-sitter runtime, copied from
   node_modules/web-tree-sitter/web-tree-sitter.wasm (web-tree-sitter 0.26.10).
2. tree-sitter-javascript.wasm — tree-sitter/tree-sitter-javascript v0.25.0
   GitHub release asset.
3. tree-sitter-typescript.wasm and tree-sitter-tsx.wasm —
   tree-sitter/tree-sitter-typescript v0.23.2 GitHub release assets.
4. tree-sitter-python.wasm — tree-sitter/tree-sitter-python v0.25.0
   GitHub release asset.

Compatibility note: grammar binaries must be recent enough for the
web-tree-sitter runtime version (language ABI 13-15 for 0.26, and the
modern emscripten dylink.0 format). The prebuilt binaries in the
tree-sitter-wasms npm package use the legacy dylink format and DO NOT load
in web-tree-sitter 0.26; use the official GitHub release assets instead.
When bumping web-tree-sitter, re-run the structural-diff tests, which
exercise real parsing through these files.
