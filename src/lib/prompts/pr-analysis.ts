import type { FileStructuralDiff, SymbolChange } from '@/lib/structural-diff';

export type PrMeta = {
  title: string;
  author: string;
  filesChanged: number;
  additions: number;
  deletions: number;
};

const MAX_BODY_CHARS = 500;

/**
 * Build the system prompt for the PR analysis call.
 *
 * The prompt establishes Claude's role as a senior reviewer and pins down
 * the exact contract for the `submit_analysis` tool — what counts as a
 * behavioral change, which risks to flag, how to scope risk_level, and how
 * many sentences the summary must contain.
 */
export function buildSystemPrompt(): string {
  return `You are a senior code reviewer. Your job is to analyze a pull request's structural diff and tell another engineer what behaviorally changed — not what stylistically changed.

Rules:

1. Focus on BEHAVIORAL changes only. What does the code now do that it did not do before, or stop doing? Ignore renames, formatting, comment edits, and pure refactors that preserve behavior. If a change is purely cosmetic, do not surface it.

2. The summary field MUST be exactly 3 sentences. It is read in 30 seconds by a busy reviewer who needs the gist. No bullet points, no headers — three plain sentences.

3. risk_flags must call out specific risks when they apply. Use short kebab-case labels and only include flags that genuinely apply:
   - "auth-change" — authentication or authorization logic changed
   - "sql-change" — SQL queries or schema access changed
   - "removed-validation" — input validation was deleted or weakened
   - "new-external-api" — a new outbound HTTP/API call was introduced
   - "payment-logic" — financial, billing, or payment code was modified
   - "regex-change" — a regular expression was added or modified
   - "dependency-added" — a new third-party package was introduced
   You may include other concise kebab-case labels if a different risk applies.

4. risk_level reflects what could break in production if this PR ships unreviewed — NOT how large the diff is. A 3-line auth change is "high". A 500-line CSS refactor is "low". Use:
   - "low": cosmetic, internal refactor, or low-blast-radius feature
   - "medium": user-visible feature change or non-critical logic edit
   - "high": touches auth, payments, data integrity, security, or external contracts

5. focus_areas points reviewers to specific spots worth their attention. Maximum 3 entries. Each entry must contain:
   - file: the file path exactly as given in the diff
   - lines: a line range string like "42-58" or "10"
   - reason: one sentence explaining why a reviewer should look here

6. ALWAYS submit your analysis through the submit_analysis tool. Never respond in plain text — plain text responses are a protocol violation.`;
}

/**
 * Build the user-message prompt that ships the structural diff to Claude.
 *
 * The diff is rendered per file with added / modified / removed symbols and
 * their body text. `unchanged` symbols are skipped. Each individual body is
 * truncated to {@link MAX_BODY_CHARS} so a single huge function cannot blow
 * out the input window.
 */
export function buildUserPrompt(prMeta: PrMeta, structuralDiff: FileStructuralDiff[]): string {
  const symbolChangeCount = structuralDiff.reduce(
    (sum, f) => sum + f.summary.added + f.summary.modified + f.summary.removed,
    0
  );

  const perFile = structuralDiff
    .filter((f) => f.summary.added + f.summary.modified + f.summary.removed > 0)
    .map((f) => renderFile(f))
    .join('\n\n');

  return `PR: ${prMeta.title}
Author: ${prMeta.author}

Files changed: ${prMeta.filesChanged}, +${prMeta.additions} / -${prMeta.deletions}
Total symbol changes: ${symbolChangeCount}

Per-file structural diff:

${perFile || '(no symbol-level changes — likely only unsupported file types)'}`;
}

function renderFile(file: FileStructuralDiff): string {
  const header = `=== ${file.filename} (${file.language ?? 'unknown'}) ===
+${file.summary.added} / ~${file.summary.modified} / -${file.summary.removed}`;

  const blocks = file.changes
    .filter((c) => c.change !== 'unchanged')
    .map((c) => renderChange(c));

  return [header, ...blocks].join('\n\n');
}

function renderChange(change: SymbolChange): string {
  if (change.change === 'added' && change.after) {
    return `[added] ${change.id}
${truncate(change.after.bodyText)}`;
  }
  if (change.change === 'removed' && change.before) {
    return `[removed] ${change.id}
${truncate(change.before.bodyText)}`;
  }
  if (change.change === 'modified' && change.before && change.after) {
    return `[modified] ${change.id}
BEFORE:
${truncate(change.before.bodyText)}
AFTER:
${truncate(change.after.bodyText)}`;
  }
  return `[${change.change}] ${change.id}`;
}

function truncate(text: string): string {
  if (text.length <= MAX_BODY_CHARS) return text;
  return `${text.slice(0, MAX_BODY_CHARS)}\n...[truncated]`;
}
