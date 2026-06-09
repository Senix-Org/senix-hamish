import { waitUntil } from '@vercel/functions';
import { supabaseAdmin } from '@features/shared/supabase';
import { enqueue, type JobPayloadMap } from '@features/review-queue/queue';
import { checkReviewLimit } from '@features/billing/plan-limits';
import { upsertPRComment } from '@features/github-integration/github-comments';
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
const LIMIT_REACHED_COMMENT = `You've reached your Senix review limit for this month. Upgrade at ${getAppBaseUrl()}/dashboard/billing`;

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
  };
  repository?: { id?: number };
  installation?: { id?: number };
};

export async function handlePullRequest(payload: PullRequestPayload): Promise<string> {
  const action = payload.action ?? '';
  if (!ACTIONS_WE_HANDLE.has(action)) {
    return `pull_request:skipped:${action}`;
  }

  const pr = payload.pull_request;
  const repoPayload = payload.repository;
  const installationId = payload.installation?.id;

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

  const reviewLimit = await checkReviewLimit(userId, 'pr');
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
  // Default path: fire-and-forget POST to the internal serverless route.
  // Vercel keeps the function alive after the webhook returns 200, so the
  // analysis runs without GitHub waiting on it.
  //
  // Fallback path: if the dispatch fails synchronously (bad URL, missing
  // secret) we push to the Redis queue so the standalone polling worker
  // can pick it up. This keeps the system functional even when the
  // serverless dispatch is misconfigured.
  const [owner, repoName] = repo.full_name.split('/');
  const jobPayload: JobPayloadMap['analyze-pr'] = {
    analysisId: analysisRow.id,
    pullRequestId: prRow.id,
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

type DispatchOutcome =
  | 'serverless-dispatched'
  | `queued:${string}`
  | 'dispatch-failed';

/**
 * Trigger the analysis. Wraps the fetch in Vercel's waitUntil so the
 * serverless function stays alive until the dispatch settles, even after
 * the webhook handler returns 200 to GitHub.
 *
 * If the fetch fails, fall back to the Redis queue so the polling worker
 * can still recover the job.
 */
async function dispatchAnalyzePr(
  payload: JobPayloadMap['analyze-pr']
): Promise<DispatchOutcome> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.INTERNAL_WORKER_SECRET;

  if (siteUrl && secret) {
    try {
      waitUntil(
        fetch(`${siteUrl}/api/internal/analyze-pr`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-senix-internal-secret': secret,
          },
          body: JSON.stringify(payload),
        }).catch((err) => {
          console.error('[pull-request] analyze-pr dispatch failed', {
            analysisId: payload.analysisId,
            message: err?.message ?? String(err),
          });
          // Fallback: enqueue to Redis so the worker can pick it up
          return enqueue('analyze-pr', payload);
        })
      );

      return 'serverless-dispatched';
    } catch (err: unknown) {
      console.error('[pull-request] failed to initiate analyze-pr fetch', {
        analysisId: payload.analysisId,
        message: errorMessage(err),
      });
      // fall through to Redis fallback
    }
  } else {
    console.warn(
      '[pull-request] NEXT_PUBLIC_SITE_URL or INTERNAL_WORKER_SECRET missing; falling back to Redis queue'
    );
  }

  try {
    const jobId = await enqueue('analyze-pr', payload);
    return `queued:${jobId}`;
  } catch (err: unknown) {
    console.error('[pull-request] Redis fallback enqueue failed', {
      analysisId: payload.analysisId,
      message: errorMessage(err),
    });
    return 'dispatch-failed';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
