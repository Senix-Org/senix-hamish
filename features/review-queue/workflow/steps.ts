import { supabaseAdmin } from '@features/shared/supabase';
import { fetchPRFiles, fetchFileContent } from '@features/github-integration/github-diff';
import { diffFile, FileStructuralDiff } from '@features/ai-engine/structural-diff';
import { detectLanguage } from '@features/ai-engine/parser';
import { analyzePR, AnalysisResult } from '@features/ai-engine/llm';
import { isOverDailyCostCap } from '@features/ai-engine/cost-tracker';
import { formatPRComment } from '@features/ai-engine/format-comment';
import { upsertPRComment } from '@features/github-integration/github-comments';
import type { JobPayloadMap } from '@features/review-queue/queue';
import { claimAnalysis } from '@features/review-queue/queue';
import { getAppBaseUrl } from '@features/shared/mcp-config';
import {
  isOverRepoLimit,
  recordTokenUsage,
  ESTIMATED_TOKENS_PER_REVIEW,
  type TokenSource,
} from '@features/billing/plan-limits';
import { captureServerEvent } from '@features/shared/posthog-server';

/**
 * The analyze-pr pipeline, decomposed into discrete, independently retryable
 * step functions. Two callers share these exact functions:
 *
 * 1. processAnalyzePr (worker/analyze-pr.ts) runs them sequentially — the
 *    standalone Node polling worker and the legacy after() path.
 * 2. AnalyzePrWorkflow wraps each in a Cloudflare Workflows step.do(), which
 *    persists every step's return value and retries steps individually. Step
 *    inputs/outputs must therefore stay JSON-serializable and comfortably
 *    under the 1 MiB per-step state cap (structural diff summaries are
 *    compact; raw file contents never cross a step boundary).
 */

export type AnalyzeJob = JobPayloadMap['analyze-pr'];

const MAX_FILES_FOR_STRUCTURAL_DIFF = 50;
// How many files to fetch from GitHub at a time. Full parallelism would let
// a 50-file PR burst-fire the GitHub API and trip abuse limits; batches of
// 10 are a safe starting point.
const FILE_FETCH_CONCURRENCY = 10;
const REPO_LIMIT_COMMENT = `This repository is over your Senix plan's repo limit, so Senix skipped this review. Upgrade or disconnect repos at ${getAppBaseUrl()}/dashboard/billing`;

type PrRow = { title: string | null; author_login: string | null };
type InstallationStatusRow = { uninstalled_at: string | null };
type PriorCommentRow = { github_comment_id: number | null };

export type PreflightResult =
  | { proceed: false; skippedReason: string }
  | { proceed: true; prTitle: string | null; prAuthor: string | null };

export type DiffSummary = {
  fileCount: number;
  supportedFileCount: number;
  totalAdditions: number;
  totalDeletions: number;
  sampleFiles: string[];
  structural: FileStructuralDiff[];
};

export type LlmOutcome = { llmResult: AnalysisResult | null; llmError: string | null };

export type CommentOutcome = {
  commentId: number | null;
  commentUrl: string | null;
  postError: string | null;
};

export type TerminalFinality =
  | 'finalized-and-refunded'
  | 'already-terminal'
  | 'no-user';

/**
 * Mark a non-terminal analysis as skipped or failed and refund the token
 * reservation that was debited at the gate. The guarded update only wins
 * once (status must still be 'queued' or 'running'), so the refund runs at
 * most once per analysis even when the Workflow failure path, the sequential
 * runner's catch/finally, and the watchdog race each other. Already-terminal
 * rows are left untouched and receive no refund — a successful completion
 * must not have its reservation clawed back.
 */
export async function finalizeAnalysisAsTerminal(
  analysisId: string,
  userId: string | null,
  terminalStatus: 'completed' | 'failed',
  errorMessage: string,
  source: TokenSource = 'pr'
): Promise<TerminalFinality> {
  if (!userId) return 'no-user';

  const { data } = (await supabaseAdmin
    .from('analyses')
    .update({
      status: terminalStatus,
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq('id', analysisId)
    .in('status', ['queued', 'running'])
    .select('id')
    .maybeSingle()) as unknown as { data: { id: string } | null };

  if (!data) return 'already-terminal';

  try {
    await recordTokenUsage(userId, 0, source, ESTIMATED_TOKENS_PER_REVIEW);
  } catch (usageErr) {
    console.error(
      `[analyze-pr] ${analysisId}: failed to refund token reservation`,
      usageErr
    );
  }
  return 'finalized-and-refunded';
}

/**
 * Step 1 — claim ownership and screen out work that must not run: an
 * uninstalled installation or an over-repo-cap account. Marks the analysis
 * row 'running' when proceeding. Idempotent: the Redis claim is keyed on
 * analysisId (a retry by the same runner re-claims via TTL semantics; a
 * competing runner backs off), and every DB write here is a plain update.
 */
export async function preflightAnalysis(job: AnalyzeJob): Promise<PreflightResult> {
  const { analysisId, pullRequestId, userId, installationId, owner, repo, prNumber } = job;

  // Exactly-once ownership: the serverless path, the Workflow, and the
  // standalone worker can all pick up the same analysis. First claim wins.
  const owns = await claimAnalysis(analysisId);
  if (!owns) {
    console.log(`[worker] skipping job — analysis ${analysisId} already claimed`);
    return { proceed: false, skippedReason: 'already claimed' };
  }

  const { data: installRow } = await supabaseAdmin
    .from('installations')
    .select('uninstalled_at')
    .eq('github_installation_id', installationId)
    .maybeSingle();
  const installation = (installRow ?? null) as unknown as InstallationStatusRow | null;

  if (installation?.uninstalled_at) {
    console.log(
      `[worker] skipping job — installation uninstalled (id=${installationId}, at=${installation.uninstalled_at})`
    );
    await finalizeAnalysisAsTerminal(
      analysisId,
      userId,
      'completed',
      'skipped: installation uninstalled'
    );
    return { proceed: false, skippedReason: 'installation uninstalled' };
  }

  // GAP 3: skip analysis (and LLM cost) for accounts currently over their
  // repo cap, e.g. after a downgrade. Post a comment so the user knows why.
  if (userId && (await isOverRepoLimit(userId))) {
    console.log(`[worker] skipping job — user ${userId} is over their repo limit`);
    await postPlainComment({ pullRequestId, installationId, owner, repo, prNumber }, REPO_LIMIT_COMMENT);
    await finalizeAnalysisAsTerminal(
      analysisId,
      userId,
      'completed',
      'skipped: over repo limit'
    );
    return { proceed: false, skippedReason: 'over repo limit' };
  }

  await supabaseAdmin.from('analyses').update({ status: 'running' }).eq('id', analysisId);

  const { data: prRow } = await supabaseAdmin
    .from('pull_requests')
    .select('title, author_login')
    .eq('id', pullRequestId)
    .single();
  const pr = (prRow ?? null) as unknown as PrRow | null;

  return { proceed: true, prTitle: pr?.title ?? null, prAuthor: pr?.author_login ?? null };
}

/**
 * Step 2 — fetch the PR file list and contents, and build the per-file
 * structural diff. Read-only against GitHub, so freely retryable. Raw file
 * contents stay inside this function; only the compact summary is returned.
 */
export async function buildDiffSummary(job: AnalyzeJob): Promise<DiffSummary> {
  const { installationId, owner, repo, prNumber, headSha, baseSha } = job;

  const files = await fetchPRFiles(installationId, owner, repo, prNumber);
  const supportedFiles = files.filter((f) => detectLanguage(f.filename) !== null);

  const structural: FileStructuralDiff[] = [];
  if (supportedFiles.length <= MAX_FILES_FOR_STRUCTURAL_DIFF) {
    // Fetch file contents in parallel batches instead of one file at a
    // time. The Octokit instance (and its cached installation token) is
    // shared across all of these calls via getInstallationOctokit's
    // module-scope cache, so no per-call JWT signing happens either.
    for (let i = 0; i < supportedFiles.length; i += FILE_FETCH_CONCURRENCY) {
      const batch = supportedFiles.slice(i, i + FILE_FETCH_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const beforeContent =
            file.status === 'added'
              ? null
              : await fetchFileContent(
                  installationId,
                  owner,
                  repo,
                  file.previous_filename ?? file.filename,
                  baseSha
                );
          const afterContent =
            file.status === 'removed'
              ? null
              : await fetchFileContent(installationId, owner, repo, file.filename, headSha);
          return diffFile(file.filename, beforeContent, afterContent);
        })
      );
      structural.push(...batchResults);
    }
  }

  return {
    fileCount: files.length,
    supportedFileCount: supportedFiles.length,
    totalAdditions: files.reduce((s, f) => s + (f.additions || 0), 0),
    totalDeletions: files.reduce((s, f) => s + (f.deletions || 0), 0),
    sampleFiles: files.slice(0, 5).map((f) => f.filename),
    structural,
  };
}

/**
 * Step 3 — run the LLM analysis through the provider failover chain, unless
 * the daily cost cap is hit. Never throws: LLM failure is recorded, not
 * escalated, because the structural diff is still worth persisting (same
 * semantics the pipeline has always had). A retry of this step can at worst
 * duplicate LLM spend, never a user-visible side effect; the daily cost cap
 * bounds that damage.
 */
export async function runLlmAnalysis(
  job: AnalyzeJob,
  pre: { prTitle: string | null; prAuthor: string | null },
  diff: DiffSummary
): Promise<LlmOutcome> {
  const { analysisId, prNumber } = job;

  if (await isOverDailyCostCap()) {
    const llmError = 'Daily cost cap exceeded — LLM analysis skipped';
    console.warn(`[analyze-pr] ${analysisId}: ${llmError}`);
    return { llmResult: null, llmError };
  }

  try {
    const llmResult = await analyzePR({
      prMeta: {
        title: pre.prTitle ?? `PR #${prNumber}`,
        author: pre.prAuthor ?? 'unknown',
        filesChanged: diff.fileCount,
        additions: diff.totalAdditions,
        deletions: diff.totalDeletions,
      },
      structuralDiff: diff.structural,
    });
    console.log(
      `[worker] analyzed via ${llmResult.provider}, cost=${llmResult.costUsdCents}¢, tokens=${llmResult.tokensUsed}`
    );
    return { llmResult, llmError: null };
  } catch (err: any) {
    const llmError = `LLM analysis failed: ${err?.message ?? String(err)}`;
    console.error(`[analyze-pr] ${analysisId}: ${llmError}`);
    return { llmResult: null, llmError };
  }
}

/**
 * Step 4 — post (or update in place) the customer-facing PR comment.
 * Duplicate-guarded two ways: the upsert-by-PR pattern reuses any prior
 * Senix comment id, and on a fresh create the id is written to the analyses
 * row HERE, inside the step, so a retry that lost the step result re-queries
 * the row and edits instead of creating a second comment.
 */
export async function postAnalysisComment(
  job: AnalyzeJob,
  llmResult: AnalysisResult
): Promise<CommentOutcome> {
  const { analysisId, pullRequestId, installationId, owner, repo, prNumber } = job;

  // Posting PR comments is the core product, so it is on by default. Only an
  // explicit POST_PR_COMMENTS=false disables it (useful for local/dev runs).
  if (process.env.POST_PR_COMMENTS === 'false') {
    console.log('[worker] skipping PR comment (POST_PR_COMMENTS=false)');
    return { commentId: null, commentUrl: null, postError: null };
  }

  const existingCommentId = await priorCommentId(pullRequestId);

  const dashboardUrl = `${getAppBaseUrl()}/dashboard/analysis/${analysisId}`;
  const body = formatPRComment({
    summary: llmResult.summary,
    riskLevel: llmResult.riskLevel,
    riskFlags: llmResult.riskFlags,
    focusAreas: llmResult.focusAreas,
    provider: llmResult.provider,
    tokensUsed: llmResult.tokensUsed,
    costUsdCents: llmResult.costUsdCents,
    dashboardUrl,
  });

  try {
    const { commentId, commentUrl } = await upsertPRComment({
      installationId,
      owner,
      repo,
      prNumber,
      commentBody: body,
      existingCommentId,
    });
    console.log(`[worker] posted comment ${commentId} on ${owner}/${repo}#${prNumber}`);

    // Persist the comment id immediately (not only in the final update):
    // this closes the retry window where a comment was created but the step
    // outcome was lost — the retry finds the id via priorCommentId and edits.
    if (commentId) {
      await supabaseAdmin
        .from('analyses')
        .update({ github_comment_id: commentId, github_comment_url: commentUrl })
        .eq('id', analysisId);
    }

    return { commentId, commentUrl, postError: null };
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error(`[worker] comment post failed: ${message}`);
    return { commentId: null, commentUrl: null, postError: message };
  }
}

/**
 * Step 5 — persist the terminal analysis result. A pure idempotent write of
 * derived state; safe to retry any number of times.
 */
export async function finalizeAnalysis(
  job: AnalyzeJob,
  diff: DiffSummary,
  llm: LlmOutcome,
  comment: CommentOutcome
): Promise<void> {
  const symbolChangeCount = diff.structural.reduce(
    (s, f) => s + f.summary.added + f.summary.modified + f.summary.removed,
    0
  );
  const errorMessage =
    [llm.llmError, comment.postError].filter((p): p is string => Boolean(p)).join(' | ') || null;

  const completedAt = new Date();
  const { data: updated } = (await supabaseAdmin
    .from('analyses')
    .update({
      status: 'completed',
      completed_at: completedAt.toISOString(),
      summary: llm.llmResult?.summary ?? null,
      risk_level: llm.llmResult?.riskLevel ?? null,
      focus_areas: llm.llmResult?.focusAreas ?? [],
      tokens_used: llm.llmResult?.tokensUsed ?? null,
      cost_usd_cents: llm.llmResult?.costUsdCents ?? null,
      error_message: errorMessage,
      risk_flags: {
        file_count: diff.fileCount,
        supported_file_count: diff.supportedFileCount,
        additions: diff.totalAdditions,
        deletions: diff.totalDeletions,
        symbol_changes: symbolChangeCount,
        structural_diff: diff.structural,
        sample_files: diff.sampleFiles,
        detected_risks: llm.llmResult?.riskFlags ?? [],
      },
      github_comment_id: comment.commentId,
      github_comment_url: comment.commentUrl,
    })
    .eq('id', job.analysisId)
    .select('created_at')
    .maybeSingle()) as unknown as { data: { created_at: string | null } | null };

  const createdAt = updated?.created_at ? new Date(updated.created_at) : null;
  const durationSeconds = createdAt
    ? Math.max(0, Math.round((completedAt.getTime() - createdAt.getTime()) / 1000))
    : undefined;

  await captureServerEvent({
    distinctId: job.userId,
    event: 'pr_review_completed',
    properties: {
      repo: `${job.owner}/${job.repo}`,
      risk_level: llm.llmResult?.riskLevel ?? undefined,
      tokens_used: llm.llmResult?.tokensUsed ?? undefined,
      duration_seconds: durationSeconds,
    },
  });
}

/**
 * Step 6 — true the token usage up from the gate's reserved estimate to the
 * actual count. Applies a delta, so a retry after a call that succeeded but
 * whose result was lost would double-apply; accepted for now because it is
 * approximate bookkeeping by design (see recordTokenUsage's doc comment) and
 * this step's failure surface is a single RPC. Never fails the analysis.
 */
export async function trueUpTokenUsage(job: AnalyzeJob, llm: LlmOutcome): Promise<void> {
  if (!job.userId || !llm.llmResult?.tokensUsed) return;
  try {
    await recordTokenUsage(job.userId, llm.llmResult.tokensUsed, 'pr', ESTIMATED_TOKENS_PER_REVIEW);
  } catch (usageErr) {
    console.error(`[analyze-pr] ${job.analysisId}: failed to record token usage`, usageErr);
  }
}

/** Shared lookup: the most recent Senix comment id already on this PR. */
async function priorCommentId(pullRequestId: string): Promise<number | null> {
  const { data: priorRow } = await supabaseAdmin
    .from('analyses')
    .select('github_comment_id')
    .eq('pull_request_id', pullRequestId)
    .not('github_comment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = (priorRow ?? null) as unknown as PriorCommentRow | null;
  return prior?.github_comment_id ?? null;
}

/**
 * Post a plain text PR comment (used for non-analysis notices like the
 * over-repo-limit skip). Honors POST_PR_COMMENTS=false and reuses any prior
 * Senix comment so notices update in place. Best-effort: errors are logged.
 */
async function postPlainComment(
  ctx: { pullRequestId: string; installationId: number; owner: string; repo: string; prNumber: number },
  body: string
): Promise<void> {
  if (process.env.POST_PR_COMMENTS === 'false') return;

  const existingCommentId = await priorCommentId(ctx.pullRequestId);

  try {
    await upsertPRComment({
      installationId: ctx.installationId,
      owner: ctx.owner,
      repo: ctx.repo,
      prNumber: ctx.prNumber,
      commentBody: body,
      existingCommentId,
    });
  } catch (err) {
    console.error('[worker] failed to post notice comment', err);
  }
}
