import { supabaseAdmin } from '@features/shared/supabase';
import type { JobPayloadMap } from '@features/review-queue/queue';
import { releaseAnalysisClaim } from '@features/review-queue/queue';
import {
  preflightAnalysis,
  buildDiffSummary,
  runLlmAnalysis,
  postAnalysisComment,
  finalizeAnalysis,
  trueUpTokenUsage,
  finalizeAnalysisAsTerminal,
} from '@features/review-queue/workflow/steps';
import type { CommentOutcome } from '@features/review-queue/workflow/steps';
import { captureServerEvent } from '@features/shared/posthog-server';

/**
 * Process an `analyze-pr` job sequentially: fetch the PR diff, build a
 * per-file structural diff, ask the active LLM provider for a behavioral
 * summary, post (or update) the customer-facing PR comment, and persist the
 * result. LLM and comment failures are recorded in `error_message` but never
 * escalate to a hard analysis failure — the structural diff is still useful.
 *
 * The pipeline's individual stages live in workflow/steps.ts and are shared
 * with AnalyzePrWorkflow (Cloudflare Workflows), which is the production
 * execution path on Workers. This sequential runner remains for the
 * standalone Node polling worker and the legacy after() fallback, where no
 * step persistence exists, so it keeps its own catch/finally safety nets.
 */
export async function processAnalyzePr(
  payload: JobPayloadMap['analyze-pr']
): Promise<void> {
  const { analysisId } = payload;

  const pre = await preflightAnalysis(payload);
  if (!pre.proceed) return;

  try {
    const diff = await buildDiffSummary(payload);
    const llm = await runLlmAnalysis(payload, pre, diff);
    const comment: CommentOutcome = llm.llmResult
      ? await postAnalysisComment(payload, llm.llmResult)
      : { commentId: null, commentUrl: null, postError: null };
    await finalizeAnalysis(payload, diff, llm, comment);
    await trueUpTokenUsage(payload, llm);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    await finalizeAnalysisAsTerminal(analysisId, payload.userId, 'failed', message);
    // Release the Redis ownership claim immediately so a requeue can be
    // picked up right away instead of waiting out the claim TTL (1 hour).
    // Best-effort: a release failure must not mask the original error.
    try {
      await releaseAnalysisClaim(analysisId);
    } catch (releaseErr) {
      console.error(`[analyze-pr] ${analysisId}: failed to release claim`, releaseErr);
    }
    await captureServerEvent({
      distinctId: payload.userId,
      event: 'pr_review_failed',
      properties: { repo: `${payload.owner}/${payload.repo}`, reason: message },
    });
    throw err;
  } finally {
    // Safety net: if the row somehow slipped through still marked 'running'
    // (e.g. the completed/failed update above itself failed, or the function
    // was killed between writes), mark it failed and refund the reservation so
    // it never stays stuck on a spinner forever nor leaks tokens.
    const finality = await finalizeAnalysisAsTerminal(
      analysisId,
      payload.userId,
      'failed',
      'Analysis did not complete'
    );
    if (finality === 'finalized-and-refunded') {
      try {
        await releaseAnalysisClaim(analysisId);
      } catch (releaseErr) {
        console.error(`[analyze-pr] ${analysisId}: failed to release claim`, releaseErr);
      }
    }
  }
}
