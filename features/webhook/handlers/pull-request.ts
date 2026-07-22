import { after } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { enqueue, type JobPayloadMap } from '@features/review-queue/queue';
import { processAnalyzePr } from '@features/review-queue/worker/analyze-pr';
import { checkTokenLimit, ESTIMATED_TOKENS_PER_REVIEW } from '@features/billing/plan-limits';
import { upsertPRComment } from '@features/github-integration/github-comments';
import {
  recordPROutcome,
  incrementCommitsAfterReview,
} from '@features/review-queue/outcome-recorder';
import { getAppBaseUrl } from '@features/shared/mcp-config';
import { findRepository } from './lookup';

/**
 * Handles pull_request events. Action set is intentionally narrow.
 * - opened: a new PR was created
 * - synchronize: new commits pushed to an existing PR
 * - reopened: a closed PR was reopened
 *
 * All other actions are ignored. Closed/merged PRs don't need analysis.
 */
const ACTIONS_WE_HANDLE = new Set(['opened', 'synchronize', 'reopened']);
const LIMIT_REACHED_COMMENT = `You've used your Senix token budget for this month. Upgrade at ${getAppBaseUrl()}/dashboard/billing for more.`;

type RepositoryRow = {
  id: string;
  full_name: string;
  enabled: boolean;
  installations: { installed_by_user_id: string | null } | null;
};

type PriorCommentRow = { github_comment_id: number | null };
type PullRequestPayload = {
  action?: string;
  pull_request?: {
    number?: number;
    id?: number;
    title?: string | null;
    user?: { login?: string | null } | null;
    state?: string;
    head?: { sha?: string };
    base?: { sha?: string };
    merged?: boolean;
    merged_at?: string | null;
    closed_at?: string | null;
  };
  repository?: { id?: number; full_name?: string };
  installation?: { id?: number };
};

export async function handlePullRequest(payload: PullRequestPayload): Promise<string> {
  const action = payload.action ?? '';

  // Outcome bookkeeping (migration 014): a closed PR needs no analysis, but
  // it labels the latest completed review — merged-despite-risk plus, on
  // merge, the scheduled 24h hotfix scan. Best-effort: recordPROutcome
  // catches its own errors and never affects webhook handling.
  if (action === 'closed') {
    const closedPr = payload.pull_request;
    const fullName = payload.repository?.full_name;
    if (closedPr?.number && fullName) {
      await recordPROutcome({
        prNumber: closedPr.number,
        repoFullName: fullName,
        merged: Boolean(closedPr.merged),
        mergedAt: closedPr.merged_at ?? null,
        closedAt: closedPr.closed_at ?? null,
      });
      return `pull_request:outcome-recorded:${fullName}#${closedPr.number}:${closedPr.merged ? 'merged' : 'closed'}`;
    }
    return 'pull_request:skipped:closed';
  }

  if (!ACTIONS_WE_HANDLE.has(action)) {
    return `pull_request:skipped:${action}`;
  }

  const pr = payload.pull_request;
  const repoPayload = payload.repository;
  const installationId = payload.installation?.id;

  // New commits after a completed review are developer pushback — count them
  // on the latest completed analysis before kicking off the re-review.
  // Best-effort: never affects the review flow.
  if (action === 'synchronize' && pr?.number && repoPayload?.full_name) {
    await incrementCommitsAfterReview({
      prNumber: pr.number,
      repoFullName: repoPayload.full_name,
    });
  }

  if (
    !pr ||
    !repoPayload?.id ||
    !installationId ||
    !pr.number ||
    !pr.id ||
    !pr.head?.sha ||
    !pr.base?.sha
  ) {
    return 'pull_request:missing-fields';
  }

  const repo = (await findRepository(repoPayload.id)) as RepositoryRow | null;
  if (!repo) return `pull_request:unknown-repo:${repoPayload.id}`;
  if (!repo.enabled) return `pull_request:repo-disabled:${repo.full_name}`;

  const userId = repo.installations?.installed_by_user_id ?? null;
  if (!userId) {
    return `pull_request:repo-not-linked:${repo.full_name}`;
  }

  // Step 1: Upsert the PR row
  const { data: prRow, error: prError } = await supabaseAdmin
    .from('pull_requests')
    .upsert(
      {
        repository_id: repo.id,
        github_pr_number: pr.number,
        github_pr_id: pr.id,
        title: pr.title,
        author_login: pr.user?.login ?? null,
        state: pr.state,
        head_sha: pr.head.sha,
        base_sha: pr.base.sha,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_pr_id' }
    )
    .select()
    .single();

  if (prError || !prRow) {
    throw new Error(`Failed to upsert PR: ${prError?.message ?? 'unknown'}`);
  }

  const reviewLimit = await checkTokenLimit(userId, ESTIMATED_TOKENS_PER_REVIEW, 'pr');
  if (!reviewLimit.allowed) {
    await postLimitReachedComment({
      pullRequestId: prRow.id,
      installationId,
      fullName: repo.full_name,
      prNumber: pr.number,
    });
    return `pull_request:limit-reached:${repo.full_name}#${pr.number}`;
  }

  // Step 2: Create the analysis row in queued state
  const { data: analysisRow, error: analysisError } = await supabaseAdmin
    .from('analyses')
    .insert({
      pull_request_id: prRow.id,
      commit_sha: pr.head.sha,
      status: 'queued',
    })
    .select()
    .single();

  if (analysisError || !analysisRow) {
    throw new Error(`Failed to create analysis: ${analysisError?.message ?? 'unknown'}`);
  }

  // Step 3: Dispatch the analysis job.
  //
  // Default path: run the analysis in an after() callback. The runtime
  // (Cloudflare Workers via waitUntil under OpenNext) keeps the invocation
  // alive after the webhook returns 200, so the analysis runs without
  // GitHub waiting on it.
  //
  // Fallback path: if the dispatch fails synchronously (bad URL, missing
  // secret) we push to the Redis queue so the standalone polling worker
  // can pick it up. This keeps the system functional even when the
  // serverless dispatch is misconfigured.
  const [owner, repoName] = repo.full_name.split('/');
  const jobPayload: JobPayloadMap['analyze-pr'] = {
    analysisId: analysisRow.id,
    pullRequestId: prRow.id,
    userId,
    installationId,
    owner,
    repo: repoName,
    prNumber: pr.number,
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
  };

  const dispatchOutcome = await dispatchAnalyzePr(jobPayload);

  return `pull_request:${action}:${repo.full_name}#${pr.number}:${dispatchOutcome}`;
}

async function postLimitReachedComment(input: {
  pullRequestId: string;
  installationId: number;
  fullName: string;
  prNumber: number;
}): Promise<void> {
  const [owner, repo] = input.fullName.split('/');
  if (!owner || !repo) return;

  const { data: priorRow } = await supabaseAdmin
    .from('analyses')
    .select('github_comment_id')
    .eq('pull_request_id', input.pullRequestId)
    .not('github_comment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = (priorRow ?? null) as unknown as PriorCommentRow | null;

  try {
    await upsertPRComment({
      installationId: input.installationId,
      owner,
      repo,
      prNumber: input.prNumber,
      commentBody: LIMIT_REACHED_COMMENT,
      existingCommentId: prior?.github_comment_id ?? null,
    });
  } catch (err) {
    console.error('[pull-request] failed to post limit reached comment', {
      fullName: input.fullName,
      prNumber: input.prNumber,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

type DispatchOutcome = 'workflow-dispatched' | 'after-dispatched';

/** Minimal shape of a Workflow binding; avoids depending on runtime types. */
type WorkflowBinding = {
  create(options?: { id?: string; params?: unknown }): Promise<unknown>;
};

/**
 * Resolve the ANALYZE_PR_WORKFLOW binding when running on Cloudflare.
 * Returns null anywhere the binding does not exist (node dev server, tests,
 * the standalone worker), which selects the legacy after() path below.
 */
async function getAnalyzeWorkflowBinding(): Promise<WorkflowBinding | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    const binding = (env as Record<string, unknown>).ANALYZE_PR_WORKFLOW;
    return binding ? (binding as WorkflowBinding) : null;
  } catch {
    return null;
  }
}

/**
 * Dispatch the analysis job.
 *
 * Preferred path: create a Cloudflare Workflow instance (AnalyzePrWorkflow)
 * and return 200 to GitHub immediately. Workflows persist and retry each
 * pipeline step independently and have no 30-second wall-clock cap — the
 * after()/waitUntil path was silently cancelled ~30s after the response
 * (see the 2026-07-17 incident in CLAUDE.md).
 *
 * Legacy path (no binding, e.g. local dev/tests, or create() failed): run
 * processAnalyzePr in a Next.js after() callback exactly as before, with the
 * Redis queue as the last-resort fallback so the standalone polling worker
 * can pick the job up.
 */
async function dispatchAnalyzePr(payload: JobPayloadMap['analyze-pr']): Promise<DispatchOutcome> {
  const workflow = await getAnalyzeWorkflowBinding();
  if (workflow) {
    try {
      // The analysis id is unique per analysis row, and Workflows reject a
      // duplicate instance id — a bonus dedup layer on top of claimAnalysis.
      await workflow.create({ id: payload.analysisId, params: payload });
      return 'workflow-dispatched';
    } catch (err: unknown) {
      console.error('[pull-request] workflow dispatch failed, falling back to after()', {
        analysisId: payload.analysisId,
        message: errorMessage(err),
      });
    }
  }

  after(async () => {
    try {
      await processAnalyzePr(payload);
    } catch (err: unknown) {
      console.error('[pull-request] background analyze-pr run failed', {
        analysisId: payload.analysisId,
        message: errorMessage(err),
      });
      try {
        await enqueue('analyze-pr', payload);
      } catch (enqueueErr: unknown) {
        console.error('[pull-request] Redis fallback enqueue failed', {
          analysisId: payload.analysisId,
          message: errorMessage(enqueueErr),
        });
      }
    }
  });

  return 'after-dispatched';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
