import { createRequire } from 'node:module';
import type Parser from 'tree-sitter';

export type SupportedLanguage = 'javascript' | 'typescript' | 'tsx' | 'python';

/**
 * tree-sitter and its grammars are native Node addons (.node binaries).
 * They load fine in a real Node.js process (the standalone worker, next dev,
 * vitest) but cannot load in the Cloudflare Workers runtime, which has no
 * native addon support. All loading is therefore lazy and guarded: when the
 * addon cannot be loaded, parseFile returns null and the structural diff
 * degrades to "no symbol detail" instead of crashing the route at import
 * time.
 */

const parserCache: Partial<Record<SupportedLanguage, Parser>> = {};

let nativeUnavailable = false;

/**
 * Require a module through an indirection that bundlers (Next/OpenNext
 * esbuild) cannot statically analyze, so the native addons are neither
 * bundled nor build-time errors. In a real Node.js runtime this resolves
 * from node_modules; in the Workers runtime createRequire exists under
 * nodejs_compat but cannot resolve unbundled modules, so it throws and
 * callers degrade gracefully.
 */
function dynamicRequire(name: string): unknown {
  const req = createRequire(import.meta.url);
  return req(name);
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

function getParser(language: SupportedLanguage): Parser | null {
  const cached = parserCache[language];
  if (cached) return cached;
  if (nativeUnavailable) return null;

  try {
    const ParserCtor = dynamicRequire('tree-sitter') as new () => Parser;
    const parser = new ParserCtor();

    switch (language) {
      case 'javascript':
        parser.setLanguage(dynamicRequire('tree-sitter-javascript'));
        break;
      case 'typescript':
        parser.setLanguage(
          (dynamicRequire('tree-sitter-typescript') as { typescript: unknown }).typescript
        );
        break;
      case 'tsx':
        parser.setLanguage((dynamicRequire('tree-sitter-typescript') as { tsx: unknown }).tsx);
        break;
      case 'python':
        parser.setLanguage(dynamicRequire('tree-sitter-python'));
        break;
    }

    parserCache[language] = parser;
    return parser;
  } catch (err) {
    if (!nativeUnavailable) {
      nativeUnavailable = true;
      console.warn(
        '[parser] native tree-sitter unavailable in this runtime; structural diff will have no symbol detail',
        { message: err instanceof Error ? err.message : String(err) }
      );
    }
    return null;
  }
}

/**
 * Parse source code into a tree-sitter Tree using the appropriate grammar.
 * Parsers are loaded lazily and cached per language.
 *
 * @param content - The source code to parse.
 * @param language - The language grammar to use.
 * @returns The resulting tree-sitter Tree, or `null` if parsing fails or the
 *   native parser cannot load in this runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseFile(content: string, language: SupportedLanguage): any {
  try {
    const parser = getParser(language);
    if (!parser) return null;
    return parser.parse(content);
  } catch {
    return null;
  }
}
