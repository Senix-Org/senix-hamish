import parseDiff from 'parse-diff';
import type { FileChange } from '@/lib/analyze-changes';

/**
 * Convert a unified git diff into the `FileChange[]` shape the analysis
 * pipeline expects.
 *
 * The playground only ever has a diff, never the full files, so before
 * and after are reconstructed from the hunks: the "before" side keeps the
 * context and deleted lines, the "after" side keeps the context and added
 * lines. That covers the changed regions plus their surrounding context,
 * which is what the structural diff needs to see.
 */

const EXTENSION_LANGUAGE: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
};

/** Infer a language from a file extension, or undefined when unknown. */
function languageForPath(path: string): string | undefined {
  const ext = path.includes('.') ? path.split('.').pop()?.toLowerCase() : undefined;
  return ext ? EXTENSION_LANGUAGE[ext] : undefined;
}

/**
 * parse-diff keeps the leading marker (' ', '+', '-') on each line's
 * content. Strip it so the reconstructed file holds real source text.
 */
function lineText(content: string): string {
  return content.length > 0 ? content.slice(1) : content;
}

/** Resolve the file path from a parsed diff file, dropping `a/` or `b/`. */
function pathForFile(file: parseDiff.File): string | null {
  const candidate =
    file.to && file.to !== '/dev/null'
      ? file.to
      : file.from && file.from !== '/dev/null'
        ? file.from
        : null;
  if (!candidate) return null;
  return candidate.replace(/^[ab]\//, '');
}

export function diffToChanges(diff: string): FileChange[] {
  const files = parseDiff(diff);
  const changes: FileChange[] = [];

  for (const file of files) {
    const path = pathForFile(file);
    if (!path) continue;

    const beforeLines: string[] = [];
    const afterLines: string[] = [];

    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        const text = lineText(change.content);
        if (change.type === 'normal') {
          beforeLines.push(text);
          afterLines.push(text);
        } else if (change.type === 'del') {
          beforeLines.push(text);
        } else {
          afterLines.push(text);
        }
      }
    }

    // A new file has no "before"; a deleted file has no "after".
    const before = file.new ? '' : beforeLines.join('\n');
    const after = file.deleted ? '' : afterLines.join('\n');

    changes.push({
      file_path: path,
      language: languageForPath(path),
      before,
      after,
    });
  }

  return changes;
}
