import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { verifyInternalAuth, internalUnauthorized } from '@/lib/internal-auth';
import { captureServerEvent } from '@features/shared/posthog-server';
import { finalizeAnalysisAsTerminal } from '@features/review-queue/workflow/steps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/check-stranded-analyses
 *
 * Watchdog for analyses killed mid-flight. The analysis runs in an after()
 * callback, which Cloudflare backs with waitUntil(); the runtime cancels
 * waitUntil work ~30s after the response is sent, and a cancellation does
 * not throw, so neither the catch handler nor the Redis fallback in
 * dispatchAnalyzePr ever runs. The row then sits in 'queued'/'running'
 * forever with no error recorded (observed 2026-07-17: 5 of the 6 most
 * recent analyses were stranded this way).
 *
 * This endpoint finds rows stuck in a non-terminal status for longer than
 * STRANDED_AFTER_MS, marks them failed with an explanatory error message
 * (so the dashboard shows an honest verdict instead of an eternal spinner),
 * and logs each one at error level so Cloudflare Observability captures it.
 * The caller (the scheduled GitHub Actions workflow) treats strandedFound
 * > 0 as a signal worth surfacing.
 *
 * This is the safety net only; the real fix is moving analysis execution
 * off waitUntil onto a primitive with a real time budget (e.g. a Cloudflare
 * Queues consumer, 15 min).
 */

const STRANDED_AFTER_MS = 2 * 60 * 1000;
const MAX_ROWS_PER_RUN = 100;

type StrandedRow = {
  id: string;
  status: string;
  commit_sha: string | null;
  created_at: string;
  pull_request_id: string | null;
  // Nested join to recover the internal user id for the PostHog event:
  // analyses -> pull_requests -> repositories -> installations.
  pull_requests: {
    repositories: {
      full_name: string | null;
      installations: { installed_by_user_id: string | null } | null;
    } | null;
  } | null;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyInternalAuth(req)) {
    return internalUnauthorized();
  }

  const cutoff = new Date(Date.now() - STRANDED_AFTER_MS).toISOString();

  const { data, error } = (await supabaseAdmin
    .from('analyses')
    .select(
      'id, status, commit_sha, created_at, pull_request_id, ' +
        'pull_requests(repositories(full_name, installations(installed_by_user_id)))'
    )
    .in('status', ['queued', 'running'])
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_ROWS_PER_RUN)) as unknown as {
    data: StrandedRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Failed to scan for stranded analyses: ${error.message}` },
      { status: 500 }
    );
  }

  const stranded = data ?? [];
  let marked = 0;

  for (const row of stranded) {
    console.error('[stranded-analysis watchdog] analysis never completed', {
      analysisId: row.id,
      status: row.status,
      commitSha: row.commit_sha,
      createdAt: row.created_at,
      pullRequestId: row.pull_request_id,
    });

    const repo = row.pull_requests?.repositories ?? null;
    const userId = repo?.installations?.installed_by_user_id ?? null;
    const finality = await finalizeAnalysisAsTerminal(
      row.id,
      userId,
      'failed',
      'Watchdog: analysis was stranded in a non-terminal state (likely cancelled by the Workers waitUntil ~30s limit) and never completed.',
      'pr'
    );

    if (finality === 'finalized-and-refunded') {
      marked += 1;
      await captureServerEvent({
        distinctId: userId,
        event: 'pr_review_failed',
        properties: {
          repo: repo?.full_name ?? undefined,
          reason: 'stranded: never completed (watchdog swept to failed)',
        },
      });
    } else if (finality === 'already-terminal') {
      // Another path (a late-finish success or a concurrent failure handler)
      // already settled the row. Not a watchdog failure, but worth noting.
      console.log('[stranded-analysis watchdog] row became terminal between scan and update', {
        analysisId: row.id,
      });
    } else {
      console.error('[stranded-analysis watchdog] failed to mark row failed', {
        analysisId: row.id,
        finality,
      });
    }
  }

  return NextResponse.json({ ok: true, strandedFound: stranded.length, marked });
}
