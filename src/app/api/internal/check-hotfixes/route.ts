import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { getInstallationOctokit } from '@features/github-integration/github-app';
import { verifyInternalAuth, internalUnauthorized } from '@/lib/internal-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/check-hotfixes
 *
 * Daily post-merge hotfix scan (migration 014). Cloudflare Workers cannot
 * schedule delayed tasks natively, so merges stamp hotfix_check_after
 * (merge + 24h) and this endpoint — triggered by the same scheduled GitHub
 * Actions workflow as the subscription reconciliation — processes every
 * check that has come due:
 *
 * 1. Find analyses whose hotfix_check_after has passed, with a recorded
 *    merge and no hotfix verdict yet.
 * 2. List commits on the repo's default branch in the 24h window after the
 *    merge. The base branch NAME is not stored (pull_requests keeps only
 *    base_sha), so the default branch is used as a proxy — which is where
 *    almost every PR merges. The window starts 1s after the merge so the
 *    PR's own merge/squash commit (whose title may legitimately contain
 *    "fix") does not count as its own hotfix.
 * 3. A commit title containing hotfix / fix: / patch / revert / rollback
 *    (case-insensitive) marks hotfix_detected = true; a clean window marks
 *    it false. Either way hotfix_check_after is cleared.
 *
 * Every row is processed independently and best-effort: a GitHub error on
 * one repo leaves that row's hotfix_check_after set for the next run.
 */

const MAX_CHECKS_PER_RUN = 50;
const HOTFIX_TITLE_PATTERN = /hotfix|fix:|patch|revert|rollback/i;
const HOTFIX_WINDOW_MS = 24 * 60 * 60 * 1000;

type DueAnalysisRow = {
  id: string;
  pr_merged_at: string;
  pull_requests: {
    github_pr_number: number;
    repositories: {
      full_name: string;
      installations: { github_installation_id: number } | null;
    } | null;
  } | null;
};

type CommitListItem = { commit?: { message?: string } };

type CheckHotfixesResponse = {
  due: number;
  checked: number;
  hotfixesFound: number;
  errors: number;
};

async function checkHotfixes(): Promise<CheckHotfixesResponse> {
  const { data: dueRows, error: dueError } = await supabaseAdmin
    .from('analyses')
    .select(
      'id, pr_merged_at, pull_requests(github_pr_number, repositories(full_name, installations(github_installation_id)))'
    )
    .lte('hotfix_check_after', new Date().toISOString())
    .is('hotfix_detected', null)
    .not('pr_merged_at', 'is', null)
    .limit(MAX_CHECKS_PER_RUN);

  if (dueError) {
    throw new Error(`Failed to query due hotfix checks: ${dueError.message}`);
  }

  const due = (dueRows ?? []) as unknown as DueAnalysisRow[];
  const result: CheckHotfixesResponse = {
    due: due.length,
    checked: 0,
    hotfixesFound: 0,
    errors: 0,
  };

  for (const analysis of due) {
    try {
      const repo = analysis.pull_requests?.repositories;
      const installationId = repo?.installations?.github_installation_id;
      if (!repo?.full_name || !installationId) {
        // Unlinkable row (repo removed, installation gone): clear the check
        // so it does not get retried forever.
        await supabaseAdmin
          .from('analyses')
          .update({ hotfix_check_after: null })
          .eq('id', analysis.id);
        continue;
      }

      const hotfixDetected = await scanForHotfix({
        installationId,
        fullName: repo.full_name,
        mergedAt: analysis.pr_merged_at,
      });

      const { error: updateError } = await supabaseAdmin
        .from('analyses')
        .update({
          hotfix_detected: hotfixDetected,
          hotfix_check_after: null,
          outcome_recorded_at: new Date().toISOString(),
        })
        .eq('id', analysis.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      result.checked += 1;
      if (hotfixDetected) result.hotfixesFound += 1;
    } catch (err) {
      // Leave hotfix_check_after set so the next daily run retries this row.
      result.errors += 1;
      console.error('[check-hotfixes] failed to check analysis', {
        analysisId: analysis.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

async function scanForHotfix(input: {
  installationId: number;
  fullName: string;
  mergedAt: string;
}): Promise<boolean> {
  const [owner, repo] = input.fullName.split('/');
  const octokit = getInstallationOctokit(input.installationId);

  const { data: repoData } = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo });
  const defaultBranch = (repoData as { default_branch?: string }).default_branch ?? 'main';

  const mergedMs = new Date(input.mergedAt).getTime();
  const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
    owner,
    repo,
    sha: defaultBranch,
    since: new Date(mergedMs + 1000).toISOString(),
    until: new Date(mergedMs + HOTFIX_WINDOW_MS).toISOString(),
    per_page: 100,
  });

  return (commits as CommitListItem[]).some((c) => {
    const title = (c.commit?.message ?? '').split('\n')[0];
    return HOTFIX_TITLE_PATTERN.test(title);
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyInternalAuth(req)) {
    return internalUnauthorized();
  }
  try {
    const result = await checkHotfixes();
    console.log('[check-hotfixes] complete', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allow scheduler platforms that issue GET cron requests.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
