export type SupportedLanguage = 'javascript' | 'typescript' | 'tsx' | 'python';

/**
 * Detection of the language of a file based on its extension.
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
 * Parse source code and extract symbol names (functions, classes, methods)
 * using language-specific regex patterns.
 *
 * This is a lightweight replacement for web-tree-sitter. It runs synchronously
 * with zero dependencies and works correctly in all environments, including
 * Cloudflare Workers (where WebAssembly.instantiate for arbitrary bytes is
 * blocked).
 *
 * @param content - The source code to parse.
 * @param language - The language to use for parsing.
 * @returns An array of symbol names found in the content, or `null` if the
 *   language is not supported.
 */
export function parseFile(content: string, language: string): string[] | null {
  const symbols: string[] = [];

  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'tsx': {
      let m: RegExpExecArray | null;

      // Named functions: export async function name(...)
      const funcRe = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
      while ((m = funcRe.exec(content)) !== null) {
        symbols.push(m[1]);
      }

      // Arrow functions assigned to const: const name = (async) => (...)
      const arrowRe = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
      while ((m = arrowRe.exec(content)) !== null) {
        symbols.push(m[1]);
      }

      // Classes: export class Name
      const classRe = /(?:export\s+)?class\s+(\w+)/g;
      while ((m = classRe.exec(content)) !== null) {
        symbols.push(m[1]);
      }

      break;
    }

    case 'python': {
      let m: RegExpExecArray | null;

      // Top-level functions: def name(...):
      const defRe = /^def\s+(\w+)/gm;
      while ((m = defRe.exec(content)) !== null) {
        symbols.push(m[1]);
      }

      // Classes: class Name:
      const pyClassRe = /^class\s+(\w+)/gm;
      while ((m = pyClassRe.exec(content)) !== null) {
        symbols.push(m[1]);
      }

      // Methods (indented def): def name(...):
      const methodRe = /^\s+def\s+(\w+)/gm;
      while ((m = methodRe.exec(content)) !== null) {
        symbols.push(m[1]);
      }

      break;
    }

    default:
      return null;
  }

  return symbols;
}