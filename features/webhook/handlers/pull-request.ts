import { after } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { enqueue, type JobPayloadMap } from '@features/review-queue/queue';
import { processAnalyzePr } from '@features/review-queue/worker/analyze-pr';
import { checkTokenLimit, ESTIMATED_TOKENS_PER_REVIEW } from '@features/billing/plan-limits';
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

  const dispatchOutcome = dispatchAnalyzePr(jobPayload);

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

type DispatchOutcome = 'after-dispatched';

/**
 * Schedule the analysis to run after the webhook responds 200 to GitHub.
 *
 * Next.js `after()` runs the callback once the response has been sent, so
 * GitHub gets its fast acknowledgement while the analysis runs in the
 * background under this route's maxDuration. We call `processAnalyzePr`
 * directly instead of POSTing to the internal analyze-pr route: removing
 * the internal HTTP hop removes a failure point and lets the webhook
 * route's maxDuration govern the analysis time.
 *
 * `processAnalyzePr` records its own success/failure on the analysis row
 * (including a finally-block safety net), so a thrown error here is already
 * reflected in the DB. As a last-resort recovery for infrastructure faults
 * (e.g. the row was never claimed), we enqueue to Redis so the standalone
 * polling worker can still pick the job up.
 */
function dispatchAnalyzePr(payload: JobPayloadMap['analyze-pr']): DispatchOutcome {
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
