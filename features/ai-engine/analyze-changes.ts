import { diffFile, type FileStructuralDiff } from '@features/ai-engine/structural-diff';
import { getLLMProvider } from '@features/ai-engine/llm';
import type { AnalysisResult } from '@features/ai-engine/llm/types';

/**
 * Shared change-analysis pipeline.
 *
 * Both the MCP `review_changes` tool and the public playground feed file
 * changes through the exact same path: tree-sitter structural diff, then
 * the shared LLM provider and analysis prompt. Keeping that path here (one
 * place, not duplicated per route) means the two surfaces cannot drift,
 * and the playground never has to call the MCP endpoint over HTTP.
 */

export type FileChange = {
  file_path: string;
  language?: string;
  /** File content before the change. Empty string for new files. */
  before: string;
  /** File content after the change. Empty string for deletions. */
  after: string;
};

export type AnalyzeResult = {
  result: AnalysisResult;
  filesReviewed: number;
};

/** Identify which session a set of changes came from, for the LLM prompt. */
type SessionMeta = {
  title: string;
  author: string;
};

/** Type guard for a single file change in untyped (e.g. JSON-RPC) input. */
export function isFileChange(value: unknown): value is FileChange {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.file_path === 'string' &&
    typeof v.before === 'string' &&
    typeof v.after === 'string'
  );
}

/** Crude but reasonable additions/deletions estimate from line counts. */
function lineDelta(before: string, after: string): { additions: number; deletions: number } {
  const beforeLines = before === '' ? 0 : before.split('\n').length;
  const afterLines = after === '' ? 0 : after.split('\n').length;
  return {
    additions: Math.max(0, afterLines - beforeLines) || (before === '' ? afterLines : 0),
    deletions: Math.max(0, beforeLines - afterLines) || (after === '' ? beforeLines : 0),
  };
}

/**
 * Run a list of validated file changes through the structural-diff and
 * LLM pipeline. This is the core both surfaces share.
 */
export async function analyzeFileChanges(
  changes: FileChange[],
  session: SessionMeta
): Promise<AnalyzeResult> {
  if (changes.length === 0) {
    throw new Error('No file changes to analyze.');
  }

  const structuralDiff: FileStructuralDiff[] = [];
  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    // Empty string means "no such file on that side" (new file / deletion).
    const before = change.before === '' ? null : change.before;
    const after = change.after === '' ? null : change.after;
    structuralDiff.push(diffFile(change.file_path, before, after));

    const delta = lineDelta(change.before, change.after);
    additions += delta.additions;
    deletions += delta.deletions;
  }

  const result = await getLLMProvider().analyzePR({
    prMeta: {
      title: session.title,
      author: session.author,
      filesChanged: changes.length,
      additions,
      deletions,
    },
    structuralDiff,
  });

  return { result, filesReviewed: changes.length };
}

/**
 * Validate a raw MCP `tools/call` arguments object, then analyze it.
 * Used by the MCP route so that route handler stays thin.
 */
export async function runAnalysis(args: Record<string, unknown>): Promise<AnalyzeResult> {
  const rawChanges = args.changes;
  if (!Array.isArray(rawChanges) || rawChanges.length === 0) {
    throw new Error('`changes` must be a non-empty array of file changes.');
  }

  const changes: FileChange[] = [];
  for (const item of rawChanges) {
    if (!isFileChange(item)) {
      throw new Error(
        'Each change must have string `file_path`, `before`, and `after` fields.'
      );
    }
    changes.push(item);
  }

  const context =
    typeof args.context === 'string' && args.context.trim() ? args.context.trim() : null;

  return analyzeFileChanges(changes, {
    title: context ?? 'mcp-session',
    author: 'mcp-session',
  });
}

/**
 * Render the analysis as the human-readable shipping brief. This is the
 * text shown in an IDE chat panel and in the playground output area.
 */
export function formatShippingBrief(result: AnalysisResult, filesReviewed: number): string {
  const fileWord = filesReviewed === 1 ? 'file' : 'files';
  const lines: string[] = [
    `Senix reviewed ${filesReviewed} changed ${fileWord}.`,
    '',
    `Overall risk: ${result.riskLevel.toUpperCase()}`,
    '',
    'Behavioral summary:',
    result.summary,
    '',
    `Ship decision: ${result.shipDecision}`,
    '',
  ];

  if (result.riskyFiles.length > 0) {
    lines.push('Risky files:');
    result.riskyFiles.forEach((file, index) => {
      const location = file.lineRange ? `${file.file}:${file.lineRange}` : file.file;
      const heading = file.symbol ? `${location} (${file.symbol})` : location;
      lines.push(`${index + 1}. ${heading}`);
      lines.push(`   What changed: ${file.whatChanged}`);
      lines.push(`   Why risky: ${file.whyRisky}`);
      lines.push(`   How to verify: ${file.howToVerify}`);
      lines.push(`   Suggested fix: ${file.suggestedFix}`);
      lines.push('');
    });
    lines.pop(); // Drop the trailing blank line after the last risky file.
  } else {
    lines.push('No high-risk changes detected.');
  }

  if (result.verificationSteps.length > 0) {
    lines.push('', 'Verification steps:');
    result.verificationSteps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
  }

  return lines.join('\n');
}
