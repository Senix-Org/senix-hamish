import { supabaseAdmin } from '@features/shared/supabase';
import { fetchPRFiles, fetchFileContent } from '@features/github-integration/github-diff';
import { diffFile, FileStructuralDiff } from '@features/ai-engine/structural-diff';
import { detectLanguage } from '@features/ai-engine/parser';
import { analyzePR, AnalysisResult } from '@features/ai-engine/llm';
import { isOverDailyCostCap } from '@features/ai-engine/cost-tracker';
import { formatPRComment } from '@features/ai-engine/format-comment';
import { upsertPRComment } from '@features/github-integration/github-comments';
import type { JobPayloadMap } from '@features/review-queue/queue';
import { claimAnalysis, releaseAnalysisClaim } from '@features/review-queue/queue';
import { getAppBaseUrl } from '@features/shared/mcp-config';
import {
  isOverRepoLimit,
  recordTokenUsage,
  ESTIMATED_TOKENS_PER_REVIEW,
} from '@features/billing/plan-limits';

const MAX_FILES_FOR_STRUCTURAL_DIFF = 50;
// How many files to fetch from GitHub at a time. Full parallelism would let
// a 50-file PR burst-fire the GitHub API and trip abuse limits; batches of
// 10 are a safe starting point.
const FILE_FETCH_CONCURRENCY = 10;
const REPO_LIMIT_COMMENT = `This repository is over your Senix plan's repo limit, so Senix skipped this review. Upgrade or disconnect repos at ${getAppBaseUrl()}/dashboard/billing`;

type PrRow = { title: string | null; author_login: string | null };
type InstallationStatusRow = { uninstalled_at: string | null };
type PriorCommentRow = { github_comment_id: number | null };
type CommentOutcome = { commentId: number | null; commentUrl: string | null; postError: string | null };
type CommentContext = { analysisId: string; pullRequestId: string; installationId: number; owner: string; repo: string; prNumber: number };

/**
 * Process an `analyze-pr` job: fetch the PR diff, build a per-file
 * structural diff, ask the active LLM provider for a behavioral summary,
 * post (or update) the customer-facing PR comment, and persist the result.
 * LLM and comment failures are recorded in `error_message` but never
 * escalate to a hard analysis failure — the structural diff is still useful.
 */
export async function processAnalyzePr(
  payload: JobPayloadMap['analyze-pr']
): Promise<void> {
  const { analysisId, pullRequestId, userId, installationId, owner, repo, prNumber, headSha, baseSha } =
    payload;

  // Exactly-once ownership: the serverless analyze path and the standalone
  // worker can both pick up the same analysis. The first to claim it wins;
  // any other caller backs off here so the work never runs twice.
  const owns = await claimAnalysis(analysisId);
  if (!owns) {
    console.log(`[worker] skipping job — analysis ${analysisId} already claimed`);
    return;
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
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: 'skipped: installation uninstalled',
      })
      .eq('id', analysisId);
    return;
  }

  // GAP 3: skip analysis (and LLM cost) for accounts currently over their
  // repo cap, e.g. after a downgrade. Post a comment so the user knows why.
  if (userId && (await isOverRepoLimit(userId))) {
    console.log(`[worker] skipping job — user ${userId} is over their repo limit`);
    await postPlainComment({ pullRequestId, installationId, owner, repo, prNumber }, REPO_LIMIT_COMMENT);
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: 'skipped: over repo limit',
      })
      .eq('id', analysisId);
    return;
  }

  await supabaseAdmin.from('analyses').update({ status: 'running' }).eq('id', analysisId);

  try {
    const { data: prRow } = await supabaseAdmin
      .from('pull_requests')
      .select('title, author_login')
      .eq('id', pullRequestId)
      .single();
    const pr = (prRow ?? null) as unknown as PrRow | null;

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

    const totalAdditions = files.reduce((s, f) => s + (f.additions || 0), 0);
    const totalDeletions = files.reduce((s, f) => s + (f.deletions || 0), 0);
    const symbolChangeCount = structural.reduce(
      (s, f) => s + f.summary.added + f.summary.modified + f.summary.removed,
      0
    );

    let llmResult: AnalysisResult | null = null;
    let llmError: string | null = null;

    if (await isOverDailyCostCap()) {
      llmError = 'Daily cost cap exceeded — LLM analysis skipped';
      console.warn(`[analyze-pr] ${analysisId}: ${llmError}`);
    } else {
      try {
        llmResult = await analyzePR({
          prMeta: {
            title: pr?.title ?? `PR #${prNumber}`,
            author: pr?.author_login ?? 'unknown',
            filesChanged: files.length,
            additions: totalAdditions,
            deletions: totalDeletions,
          },
          structuralDiff: structural,
        });
        console.log(
          `[worker] analyzed via ${llmResult.provider}, cost=${llmResult.costUsdCents}¢, tokens=${llmResult.tokensUsed}`
        );
      } catch (err: any) {
        llmError = `LLM analysis failed: ${err?.message ?? String(err)}`;
        console.error(`[analyze-pr] ${analysisId}: ${llmError}`);
      }
    }

    const comment: CommentOutcome = llmResult
      ? await postPRComment({ analysisId, pullRequestId, installationId, owner, repo, prNumber }, llmResult)
      : { commentId: null, commentUrl: null, postError: null };

    const errorMessage =
      [llmError, comment.postError].filter((p): p is string => Boolean(p)).join(' | ') || null;

    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        summary: llmResult?.summary ?? null,
        risk_level: llmResult?.riskLevel ?? null,
        focus_areas: llmResult?.focusAreas ?? [],
        tokens_used: llmResult?.tokensUsed ?? null,
        cost_usd_cents: llmResult?.costUsdCents ?? null,
        error_message: errorMessage,
        risk_flags: {
          file_count: files.length,
          supported_file_count: supportedFiles.length,
          additions: totalAdditions,
          deletions: totalDeletions,
          symbol_changes: symbolChangeCount,
          structural_diff: structural,
          sample_files: files.slice(0, 5).map((f) => f.filename),
          detected_risks: llmResult?.riskFlags ?? [],
        },
        github_comment_id: comment.commentId,
        github_comment_url: comment.commentUrl,
      })
      .eq('id', analysisId);

    // True usage up from the estimate the webhook gate reserved to the
    // actual count. Never fail the analysis over a usage-bookkeeping error.
    if (userId && llmResult?.tokensUsed) {
      try {
        await recordTokenUsage(userId, llmResult.tokensUsed, 'pr', ESTIMATED_TOKENS_PER_REVIEW);
      } catch (usageErr) {
        console.error(`[analyze-pr] ${analysisId}: failed to record token usage`, usageErr);
      }
    }
  } catch (err: any) {
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: err?.message ?? String(err),
      })
      .eq('id', analysisId);
    // Release the Redis ownership claim immediately so a requeue can be
    // picked up right away instead of waiting out the claim TTL (1 hour).
    // Best-effort: a release failure must not mask the original error.
    try {
      await releaseAnalysisClaim(analysisId);
    } catch (releaseErr) {
      console.error(`[analyze-pr] ${analysisId}: failed to release claim`, releaseErr);
    }
    throw err;
  } finally {
    // Safety net: if the row somehow slipped through still marked 'running'
    // (e.g. the completed/failed update above itself failed, or the function
    // was killed between writes), mark it failed so it never stays stuck on
    // a spinner forever.
    const { data: finalRow } = await supabaseAdmin
      .from('analyses')
      .select('status')
      .eq('id', analysisId)
      .maybeSingle();
    const current = (finalRow ?? null) as unknown as { status: string | null } | null;

    if (current?.status === 'running') {
      await supabaseAdmin
        .from('analyses')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Analysis did not complete',
        })
        .eq('id', analysisId);
      // This is a failure path too: clear the claim so a requeue is not
      // blocked until the TTL expires. Best-effort, same as the catch above.
      try {
        await releaseAnalysisClaim(analysisId);
      } catch (releaseErr) {
        console.error(`[analyze-pr] ${analysisId}: failed to release claim`, releaseErr);
      }
    }
  }
}

/**
 * Post a plain text PR comment (used for non-analysis notices like the
 * over-repo-limit skip). Honors POST_PR_COMMENTS=false and reuses any prior
 * Senix comment so notices update in place. Best-effort: errors are logged.
 */
async function postPlainComment(
  ctx: Omit<CommentContext, 'analysisId'>,
  body: string
): Promise<void> {
  if (process.env.POST_PR_COMMENTS === 'false') return;

  const { data: priorRow } = await supabaseAdmin
    .from('analyses')
    .select('github_comment_id')
    .eq('pull_request_id', ctx.pullRequestId)
    .not('github_comment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = (priorRow ?? null) as unknown as PriorCommentRow | null;

  try {
    await upsertPRComment({
      installationId: ctx.installationId,
      owner: ctx.owner,
      repo: ctx.repo,
      prNumber: ctx.prNumber,
      commentBody: body,
      existingCommentId: prior?.github_comment_id ?? null,
    });
  } catch (err) {
    console.error('[worker] failed to post notice comment', err);
  }
}

async function postPRComment(
  ctx: CommentContext,
  llmResult: AnalysisResult
): Promise<CommentOutcome> {
  // Posting PR comments is the core product, so it is on by default. Only an
  // explicit POST_PR_COMMENTS=false disables it (useful for local/dev runs).
  if (process.env.POST_PR_COMMENTS === 'false') {
    console.log('[worker] skipping PR comment (POST_PR_COMMENTS=false)');
    return { commentId: null, commentUrl: null, postError: null };
  }

  const { data: priorRow } = await supabaseAdmin
    .from('analyses')
    .select('github_comment_id')
    .eq('pull_request_id', ctx.pullRequestId)
    .not('github_comment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = (priorRow ?? null) as unknown as PriorCommentRow | null;
  const existingCommentId = prior?.github_comment_id ?? null;

  const dashboardUrl = `${getAppBaseUrl()}/dashboard/analysis/${ctx.analysisId}`;
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
      installationId: ctx.installationId,
      owner: ctx.owner,
      repo: ctx.repo,
      prNumber: ctx.prNumber,
      commentBody: body,
      existingCommentId,
    });
    console.log(`[worker] posted comment ${commentId} on ${ctx.owner}/${ctx.repo}#${ctx.prNumber}`);
    return { commentId, commentUrl, postError: null };
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error(`[worker] comment post failed: ${message}`);
    return { commentId: null, commentUrl: null, postError: message };
  }
}
