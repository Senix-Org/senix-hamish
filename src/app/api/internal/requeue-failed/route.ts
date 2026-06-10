import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { enqueue } from '@features/review-queue/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FailedAnalysisRow = {
  id: string;
  pull_request_id: string | null;
};

type PrJoinRow = {
  github_pr_number: number;
  head_sha: string;
  base_sha: string;
  repositories: {
    full_name: string;
    installations: {
      github_installation_id: number;
      installed_by_user_id: string | null;
    } | null;
  } | null;
};

type RequeueResponse = {
  requeued: number;
  skipped: number;
};

/**
 * Validate the Basic Auth header against `INTERNAL_PASSWORD`.
 * Mirrors `src/middleware.ts` — needed inline because the matcher only covers
 * `/internal/:path*`, not `/api/internal/*`.
 */
function isAuthorized(req: NextRequest): boolean {
  const password = process.env.INTERNAL_PASSWORD;
  if (!password) return true;
  const auth = req.headers.get('authorization');
  if (!auth) return false;
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const decoded = Buffer.from(encoded, 'base64').toString();
  const [, providedPassword] = decoded.split(':');
  return providedPassword === password;
}

function unauthorized(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Internal"' },
  });
}

/**
 * POST /api/internal/requeue-failed
 *
 * Requeue every analysis that failed in the last 24 hours. Mirrors the
 * `scripts/requeue-failed.ts` logic so the test panel can trigger the same
 * recovery flow without shelling out.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return unauthorized();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: failedRows, error: failedError } = await supabaseAdmin
    .from('analyses')
    .select('id, pull_request_id')
    .eq('status', 'failed')
    .gt('created_at', cutoff);

  if (failedError) {
    throw new Error(`Failed to query failed analyses: ${failedError.message}`);
  }

  const failed = (failedRows ?? []) as unknown as FailedAnalysisRow[];

  let requeued = 0;
  let skipped = 0;

  for (const analysis of failed) {
    if (!analysis.pull_request_id) {
      skipped++;
      continue;
    }

    const { data: prRow } = await supabaseAdmin
      .from('pull_requests')
      .select(
        'github_pr_number, head_sha, base_sha, repositories(full_name, installations(github_installation_id, installed_by_user_id))'
      )
      .eq('id', analysis.pull_request_id)
      .single();

    const pr = prRow as unknown as PrJoinRow | null;
    if (
      !pr ||
      !pr.repositories ||
      !pr.repositories.installations ||
      !pr.repositories.installations.installed_by_user_id
    ) {
      skipped++;
      continue;
    }

    const [owner, repoName] = pr.repositories.full_name.split('/');

    await enqueue('analyze-pr', {
      analysisId: analysis.id,
      pullRequestId: analysis.pull_request_id,
      userId: pr.repositories.installations.installed_by_user_id,
      installationId: pr.repositories.installations.github_installation_id,
      owner,
      repo: repoName,
      prNumber: pr.github_pr_number,
      headSha: pr.head_sha,
      baseSha: pr.base_sha,
    });

    const { error: updateError } = await supabaseAdmin
      .from('analyses')
      .update({ status: 'queued', error_message: null })
      .eq('id', analysis.id);

    if (updateError) {
      throw new Error(
        `Job enqueued but failed to reset analysis ${analysis.id}: ${updateError.message}`
      );
    }

    requeued++;
  }

  const body: RequeueResponse = { requeued, skipped };
  return NextResponse.json(body);
}
