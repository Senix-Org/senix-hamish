import { SupportedLanguage } from './parser';

export type SymbolKind = 'function' | 'method' | 'class' | 'const' | 'unknown';

export interface Symbol {
  /** Stable identifier within the file, e.g. "MyClass.greet" or "hello" */
  id: string;
  name: string;
  kind: SymbolKind;
  /** 1-based line numbers, inclusive */
  startLine: number;
  endLine: number;
  /** A normalized text representation of the symbol's body — used for change detection */
  bodyHash: string;
  /** Raw body text, useful for the LLM later */
  bodyText: string;
}

/**
 * Cheap content fingerprint. Strips whitespace and hashes. Two implementations
 * with identical logic but different formatting will produce the same hash.
 * We use this to detect "real" code changes vs. cosmetic ones.
 */
function hashBody(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Regex patterns per language group. Each pattern captures the symbol name
 * in group 1. The full match text serves as the symbol's body for hashing.
 */
interface LanguagePattern {
  regex: RegExp;
  kind: SymbolKind;
}

function getPatterns(language: SupportedLanguage): LanguagePattern[] {
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'tsx':
      return [
        { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g, kind: 'function' },
        { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g, kind: 'function' },
        { regex: /(?:export\s+)?class\s+(\w+)/g, kind: 'class' },
      ];
    case 'python':
      return [
        { regex: /^class\s+(\w+)/gm, kind: 'class' },
        { regex: /^def\s+(\w+)/gm, kind: 'function' },
        { regex: /^\s+def\s+(\w+)/gm, kind: 'method' },
      ];
  }
}

/**
 * Extracts symbols from source code using language-specific regex patterns.
 * This is a lightweight replacement for tree-sitter-based extraction that
 * works identically in all environments (Cloudflare Workers, Node, browser).
 *
 * @param content - The full source code text.
 * @param language - The language to use for extraction.
 * @returns An array of extracted symbols.
 */
export function extractSymbols(content: string, language: SupportedLanguage): Symbol[] {
  const symbols: Symbol[] = [];
  const patterns = getPatterns(language);
  const lines = content.split('\n');

  for (const { regex, kind } of patterns) {
    let m: RegExpExecArray | null;
    regex.lastIndex = 0;

    while ((m = regex.exec(content)) !== null) {
      const name = m[1];

      // Avoid duplicating symbols across patterns (e.g. a class matched
      // twice by overlapping regexes).
      if (symbols.some((s) => s.name === name && s.kind === kind)) {
        continue;
      }

      // Compute 1-based line number from the match position.
      const textBefore = content.slice(0, m.index);
      const startLine = (textBefore.match(/\n/g) || []).length + 1;

      // The body text is everything from the matched line through the
      // next 4 newlines (or end of file), which captures the function
      // signature and a few lines of its body.
      const lineStart = m.index;
      let newlineCount = 0;
      let endIdx = lineStart;
      for (let i = lineStart; i < content.length && newlineCount < 5; i++) {
        if (content[i] === '\n') newlineCount++;
        endIdx = i + 1;
      }
      const bodyText = content.slice(lineStart, endIdx).trimEnd();
      const endLine = Math.min(startLine + 4, lines.length);

      symbols.push({
        id: name,
        name,
        kind,
        startLine,
        endLine,
        bodyHash: hashBody(bodyText),
        bodyText,
      });
    }
  }

  return symbols;
}
