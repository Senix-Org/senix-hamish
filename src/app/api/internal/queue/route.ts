import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { queueStats } from '@features/review-queue/queue';
import { verifyInternalAuth, internalUnauthorized } from '@/lib/internal-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FailedAnalysisRow = {
  id: string;
  error_message: string | null;
  created_at: string;
  pull_request_id: string | null;
};

type QueueInspectionResponse = {
  queued: number;
  processing: number;
  recentFailed: FailedAnalysisRow[];
};

/**
 * GET /api/internal/queue
 *
 * Returns the current Redis queue depth and the 5 most recently failed
 * analyses. Used by the internal dashboard for at-a-glance health.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyInternalAuth(req)) return internalUnauthorized();

  const stats = await queueStats();

  const { data: failedRows, error: failedError } = await supabaseAdmin
    .from('analyses')
    .select('id, error_message, created_at, pull_request_id')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5);

  if (failedError) {
    throw new Error(`Failed to load recent failures: ${failedError.message}`);
  }

  const recentFailed = (failedRows ?? []) as unknown as FailedAnalysisRow[];

  const body: QueueInspectionResponse = {
    queued: stats.queued,
    processing: stats.processing,
    recentFailed,
  };

  return NextResponse.json(body);
}
