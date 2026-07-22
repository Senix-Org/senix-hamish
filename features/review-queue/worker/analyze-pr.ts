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
    await captureServerEvent({
      distinctId: payload.userId,
      event: 'pr_review_failed',
      properties: { repo: `${payload.owner}/${payload.repo}`, reason: err?.message ?? String(err) },
    });
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
