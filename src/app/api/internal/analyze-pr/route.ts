import { NextRequest, NextResponse } from 'next/server';
import { processAnalyzePr } from '@features/review-queue/worker/analyze-pr';
import type { JobPayloadMap } from '@features/review-queue/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 5 minutes. DeepSeek calls on large diffs routinely run past the 60s
// default and were being killed with 504 FUNCTION_INVOCATION_TIMEOUT,
// leaving analysis rows stuck at status = 'running'. 300 is the Vercel
// Pro ceiling without Fluid Compute; on Hobby the max is 60 and this
// value is silently clamped, so the plan must be Pro (or Fluid Compute
// enabled) for this to take effect.
export const maxDuration = 300;

type AnalyzePrPayload = JobPayloadMap['analyze-pr'];

function isAnalyzePrPayload(value: unknown): value is AnalyzePrPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.analysisId === 'string' &&
    typeof v.pullRequestId === 'string' &&
    typeof v.userId === 'string' &&
    typeof v.installationId === 'number' &&
    typeof v.owner === 'string' &&
    typeof v.repo === 'string' &&
    typeof v.prNumber === 'number' &&
    typeof v.headSha === 'string' &&
    typeof v.baseSha === 'string'
  );
}

export async function POST(req: NextRequest) {
  const expected = process.env.INTERNAL_WORKER_SECRET;
  if (!expected) {
    console.error('[analyze-pr route] INTERNAL_WORKER_SECRET is not configured');
    return NextResponse.json(
      { error: 'Server misconfigured: INTERNAL_WORKER_SECRET missing' },
      { status: 500 }
    );
  }

  const provided = req.headers.get('x-senix-internal-secret');
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isAnalyzePrPayload(body)) {
    return NextResponse.json(
      { error: 'Payload does not match analyze-pr job shape' },
      { status: 400 }
    );
  }

  try {
    await processAnalyzePr(body);
    return NextResponse.json({
      ok: true,
      status: 'completed',
      analysisId: body.analysisId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[analyze-pr route] processing failed', {
      analysisId: body.analysisId,
      message,
    });
    return NextResponse.json(
      { ok: false, status: 'failed', analysisId: body.analysisId, error: message },
      { status: 500 }
    );
  }
}
