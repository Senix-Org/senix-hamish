import { Parser, Language } from 'web-tree-sitter';
import type { Tree } from 'web-tree-sitter';

export type SupportedLanguage = 'javascript' | 'typescript' | 'tsx' | 'python';

/**
 * Parsing is backed by web-tree-sitter (the WebAssembly build), which runs
 * in every runtime Senix uses: the Cloudflare Workers isolate, next dev,
 * vitest, and the standalone Node worker. The old native tree-sitter addon
 * could not load in workerd at all, so structural diffs on Cloudflare
 * degraded to no symbol detail.
 *
 * The WASM binaries live in public/wasm/ (checked in, copied from the
 * web-tree-sitter runtime and the prebuilt tree-sitter-wasms grammars).
 * They are static assets served next to the app, NOT part of the Worker
 * bundle. Loading is runtime-adaptive:
 *   1. Node (vitest, next dev, the worker): read the bytes from
 *      public/wasm/ on disk.
 *   2. Workers (no filesystem): fetch the bytes from the app's own public
 *      URL, where the ASSETS binding serves them.
 * Everything is cached at module scope, so each isolate/process pays the
 * load cost once per language.
 *
 * All failures degrade gracefully: parseFile resolves null and the
 * structural diff reports no symbol detail, never a crashed review.
 */

let initPromise: Promise<boolean> | null = null;
const languageCache = new Map<SupportedLanguage, Promise<Language | null>>();
const parserCache: Partial<Record<SupportedLanguage, Parser>> = {};

/** Grammar wasm filename (under public/wasm/) per supported language. */
const GRAMMAR_FILES: Record<SupportedLanguage, string> = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  python: 'tree-sitter-python.wasm',
};

/**
 * Load a wasm file's bytes. Tries the local filesystem first (Node
 * runtimes), then falls back to fetching the app's own /wasm/ static asset
 * (Workers runtime, where node:fs has no real files). Returns null when
 * neither path works.
 */
async function loadWasmBytes(filename: string): Promise<Uint8Array | null> {
  try {
    const [{ readFile }, { join }] = await Promise.all([
      import('node:fs/promises'),
      import('node:path'),
    ]);
    return new Uint8Array(await readFile(join(process.cwd(), 'public', 'wasm', filename)));
  } catch {
    // No filesystem (or file missing): fall through to fetch.
  }

  try {
    // Deferred import to avoid a module cycle at load time.
    const { getAppBaseUrl } = await import('@features/shared/mcp-config');
    const response = await fetch(`${getAppBaseUrl()}/wasm/${filename}`);
    if (!response.ok) {
      console.warn(`[parser] wasm fetch failed for ${filename}: HTTP ${response.status}`);
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  } catch (err) {
    console.warn(
      `[parser] wasm unavailable for ${filename}: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/** Initialize the web-tree-sitter runtime once. Resolves false on failure. */
function initParserRuntime(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      const wasmBinary = await loadWasmBytes('tree-sitter.wasm');
      if (!wasmBinary) return false;
      try {
        await Parser.init({ wasmBinary });
        return true;
      } catch (err) {
        console.warn(
          `[parser] web-tree-sitter init failed: ${err instanceof Error ? err.message : String(err)}`
        );
        return false;
      }
    })();
  }
  return initPromise;
}

/** Load and cache a language grammar. Resolves null when unavailable. */
function getLanguage(language: SupportedLanguage): Promise<Language | null> {
  let cached = languageCache.get(language);
  if (!cached) {
    cached = (async () => {
      if (!(await initParserRuntime())) return null;
      const bytes = await loadWasmBytes(GRAMMAR_FILES[language]);
      if (!bytes) return null;
      try {
        return await Language.load(bytes);
      } catch (err) {
        console.warn(
          `[parser] grammar load failed for ${language}: ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
      }
    })();
    languageCache.set(language, cached);
  }
  return cached;
}

/**
 * Detect the language of a file based on its extension.
 *
 * @param filename - The file name or path to inspect.
 * @returns The detected language, or `null` if the extension is not supported.
 */
export function detectLanguage(filename: string): SupportedLanguage | null {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = lower.slice(dot);

  switch (ext) {
    case '.js':
    case '.jsx':
      return 'javascript';
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.py':
      return 'python';
    default:
      return null;
  }
}

/**
 * Parse source code into a tree-sitter Tree using the appropriate grammar.
 * The runtime and grammars are loaded lazily and cached per language.
 *
 * @param content - The source code to parse.
 * @param language - The language grammar to use.
 * @returns The resulting Tree, or `null` if parsing fails or the wasm
 *   runtime/grammar cannot be loaded.
 */
export async function parseFile(
  content: string,
  language: SupportedLanguage
): Promise<Tree | null> {
  try {
    const lang = await getLanguage(language);
    if (!lang) return null;

    let parser = parserCache[language];
    if (!parser) {
      parser = new Parser();
      parser.setLanguage(lang);
      parserCache[language] = parser;
    }
    return parser.parse(content);
  } catch {
    return null;
  }
}
