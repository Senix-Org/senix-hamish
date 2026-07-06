import type { FileStructuralDiff, SymbolChange } from '@features/ai-engine/structural-diff';

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
 * the exact contract for the analysis: what counts as a behavioral change,
 * which risks to flag, how to scope risk_level, how many sentences the
 * summary must contain, and the shipping-brief fields (ship_decision,
 * risky_files, verification_steps) that turn the analysis into an
 * actionable review.
 */
export function buildSystemPrompt(): string {
  return `You are a senior code reviewer. Your job is to analyze a pull request's structural diff and tell another engineer what behaviorally changed — not what stylistically changed.

Rules:

1. Focus on BEHAVIORAL changes only. What does the code now do that it did not do before, or stop doing? Ignore renames, formatting, comment edits, and pure refactors that preserve behavior. If a change is purely cosmetic, do not surface it.

2. The summary field MUST be EXACTLY 3 sentences. Not 4. Not 2. Three. If you cannot say it in 3, the most important behavioral change deserves the slot. No bullet points, no headers — three plain sentences. Never repeat what the file/function name already says (e.g. don't write "The applyDiscount function applies a discount" — that adds nothing).

3. RISK FLAG VOCABULARY. Use ONLY the flag names below. Do not invent new ones. If something doesn't fit any of these, omit the flag rather than making one up.

   - "sql-injection" — raw user input is concatenated or interpolated into a SQL query string instead of being passed as a parameter.
   - "auth-change" — addition, removal, or modification of authentication or authorization checks (sessions, tokens, role checks, middleware guards).
   - "removed-validation" — input or schema validation that previously existed has been removed or weakened. Adding new validation does NOT count.
   - "hardcoded-secret" — an API key, token, password, private key, or other secret is written literally in source code instead of read from env or a secret store.
   - "new-external-api" — a new outbound HTTP call to a third-party service (a fetch, axios call, or SDK call to an external host).
   - "dependency-added" — a new third-party package import appears that was not previously imported anywhere in the touched files.
   - "payment-logic-change" — modification to code that calculates money, prices, discounts, fees, refunds, taxes, or order totals.
   - "data-leak" — a code path now exposes data to parties that should not see it (e.g. PII returned in a public endpoint, internal IDs leaked into logs, credentials echoed in errors).

4. DO NOT FLAG the following. They are safety improvements or non-behavioral and producing flags for them is a regression:

   - Adding NEW input validation, schema checks, or type guards.
   - Adding NEW error handling, try/catch, or fallback paths.
   - Adding NEW tests or test fixtures.
   - Pure renames, extracted helpers, or inlined helpers with no behavior change.
   - Comment, docstring, or documentation edits.
   - Whitespace, formatting, or import reordering.

5. RISK LEVEL. Calibrate by impact-if-shipped-wrong, not by diff size. When in doubt, ask: "If this merged today and broke tomorrow, what's the blast radius?"

   - "high" — SQL injection, hardcoded secrets, removed authentication or authorization, removed validation, payment / pricing / billing logic changes, exposed PII or other sensitive data.
   - "medium" — new external API calls, new dependencies, NEW auth flows being added (not removed), changed public API contracts, user-visible feature changes with non-trivial logic.
   - "low" — refactors with no behavior change, documentation, type-only changes, ADDITIVE validation, test additions, mechanical renames across files, cosmetic edits.

6. focus_areas points reviewers to specific spots worth their attention. Maximum 3 entries. Each entry must contain:
   - file: the file path exactly as given in the diff
   - lines: a line range string like "42-58" or "10"
   - reason: one sentence explaining why a reviewer should look here

7. SHIP DECISION. Set ship_decision to exactly one of these three strings, and keep it consistent with risk_level:

   - "do not ship until fixed" when risk_level is "high". The change carries a real production hazard that must be resolved before merging.
   - "ship after checking" when risk_level is "medium". The change is probably fine, but a reviewer should confirm specific behavior first.
   - "safe to ship" when risk_level is "low". No behavioral hazard was found.

8. RISKY FILES. risky_files lists only the files that carry real production risk. A pure styling, formatting, comment, or documentation change must never appear here. If no file carries production risk, return an empty array. Each entry must contain:

   - file: the file path exactly as given in the diff.
   - line_range: the affected line numbers, written as a range like "20-36" or as a single line like "45".
   - symbol: the function, method, or class name involved, when one applies. Omit this field if no single symbol fits.
   - what_changed: one sentence describing what the code now does.
   - why_risky: one sentence describing the production impact if this behavior is wrong.
   - how_to_verify: one concrete test the developer can run. Name the function and the exact input, for example "Call updateUnits with a negative number and confirm the request is rejected." Never write vague advice like "test the function".
   - suggested_fix: the direction of a safe fix or guardrail. Describe what a correct fix should preserve. Do not write full code.

9. VERIFICATION STEPS. verification_steps is an ordered list of at most 5 concrete checks a developer should run before shipping. Each step must be specific and actionable, naming the function, endpoint, or input to exercise. Vague steps are not acceptable. If the change is trivial (styling, formatting, comments, or documentation only), return an empty array.

10. ALWAYS respond with a single valid JSON object matching the required schema. No prose, no markdown, no preamble — only the JSON.`;
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

// bodyText is optional on SymbolChange (omitted for unchanged symbols, which
// are filtered out above); guard anyway so the type stays honest.
function truncate(text: string | undefined): string {
  if (!text) return '';
  if (text.length <= MAX_BODY_CHARS) return text;
  return `${text.slice(0, MAX_BODY_CHARS)}\n...[truncated]`;
}
