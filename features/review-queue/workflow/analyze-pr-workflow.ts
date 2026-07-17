import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { supabaseAdmin } from '@features/shared/supabase';
import { releaseAnalysisClaim } from '@features/review-queue/queue';
import {
  preflightAnalysis,
  buildDiffSummary,
  runLlmAnalysis,
  postAnalysisComment,
  finalizeAnalysis,
  trueUpTokenUsage,
} from '@features/review-queue/workflow/steps';
import type { AnalyzeJob, CommentOutcome } from '@features/review-queue/workflow/steps';

/**
 * Cloudflare Workflows execution of the analyze-pr pipeline — the production
 * path on Workers, replacing after()/waitUntil dispatch (which the runtime
 * cancels ~30s after the webhook response; see the 2026-07-17 incident in
 * CLAUDE.md). Each stage runs in its own step.do(): step results persist
 * independently, steps retry individually on failure, and network waits face
 * no 30-second wall clock.
 *
 * Step idempotency notes live on each function in steps.ts. LLM-step retries
 * are capped tightly because analyzePR already runs a full provider failover
 * ladder internally; workflow-level retries multiply that.
 */

const STEP_RETRIES = {
  retries: { limit: 2, delay: '10 seconds' as const, backoff: 'exponential' as const },
  timeout: '5 minutes' as const,
};
const LLM_STEP_CONFIG = {
  retries: { limit: 1, delay: '30 seconds' as const, backoff: 'constant' as const },
  timeout: '10 minutes' as const,
};

export class AnalyzePrWorkflow extends WorkflowEntrypoint<Record<string, unknown>, AnalyzeJob> {
  async run(event: WorkflowEvent<AnalyzeJob>, step: WorkflowStep): Promise<void> {
    // The app code reads configuration via process.env (populated by OpenNext
    // for request contexts, but NOT for Workflow invocations). Hydrate it
    // from the Workflow's own env bindings before any step touches Supabase,
    // GitHub, or an LLM provider.
    for (const [key, value] of Object.entries(this.env)) {
      if (typeof value === 'string' && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    const job = event.payload;

    const pre = await step.do('preflight', STEP_RETRIES, () => preflightAnalysis(job));
    if (!pre.proceed) return;

    try {
      const diff = await step.do('build-structural-diff', STEP_RETRIES, () =>
        buildDiffSummary(job)
      );

      // Never throws: LLM failure is recorded in the outcome, not escalated.
      const llm = await step.do('llm-analysis', LLM_STEP_CONFIG, () =>
        runLlmAnalysis(job, pre, diff)
      );

      const comment: CommentOutcome = llm.llmResult
        ? await step.do('post-pr-comment', STEP_RETRIES, () =>
            postAnalysisComment(job, llm.llmResult!)
          )
        : { commentId: null, commentUrl: null, postError: null };

      await step.do('finalize-analysis', STEP_RETRIES, () =>
        finalizeAnalysis(job, diff, llm, comment)
      );

      await step.do('true-up-token-usage', STEP_RETRIES, () => trueUpTokenUsage(job, llm));
    } catch (err) {
      // A step exhausted its retries. Record the terminal failure and free
      // the ownership claim so a manual requeue is not blocked, then rethrow
      // so the Workflow instance itself reports as failed.
      const message = err instanceof Error ? err.message : String(err);
      await step.do('mark-analysis-failed', STEP_RETRIES, async () => {
        await supabaseAdmin
          .from('analyses')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: message,
          })
          .eq('id', job.analysisId)
          // Only overwrite non-terminal states: a concurrent finalize that
          // actually landed must not be clobbered by the failure path.
          .in('status', ['queued', 'running']);
        try {
          await releaseAnalysisClaim(job.analysisId);
        } catch (releaseErr) {
          console.error(`[analyze-pr] ${job.analysisId}: failed to release claim`, releaseErr);
        }
      });
      throw err;
    }
  }
}
