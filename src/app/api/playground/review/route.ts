import { NextRequest, NextResponse } from 'next/server';
import { analyzeFileChanges, formatShippingBrief } from '@/lib/analyze-changes';
import { diffToChanges } from '@/lib/diff-to-changes';
import { checkPlaygroundRateLimit, clientIp } from '@/lib/playground-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/playground/review
 *
 * Public, no auth. Accepts a unified git diff, parses it into file
 * changes, and runs the same analysis pipeline the MCP `review_changes`
 * tool uses. Guarded by an IP rate limit (5/hour) and a 50 KB diff cap so
 * an anonymous endpoint cannot run up LLM cost.
 *
 * Request body:  { "diff": "<unified diff string>" }
 * Response body: { "text": "<shipping brief>", "structuredContent": { ... } }
 */

const MAX_DIFF_BYTES = 50 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const diff =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).diff === 'string'
      ? ((body as Record<string, unknown>).diff as string)
      : '';

  if (!diff.trim()) {
    return NextResponse.json({ error: 'Paste a git diff to review.' }, { status: 400 });
  }

  // Size cap first: an oversized diff is rejected cheaply and never
  // counts against the caller's hourly quota.
  if (Buffer.byteLength(diff, 'utf8') > MAX_DIFF_BYTES) {
    return NextResponse.json(
      { error: 'Diff is too large for the playground. Sign up to review larger changes.' },
      { status: 413 }
    );
  }

  // Rate limit before any expensive work. Fail closed on a counter error.
  let rate;
  try {
    rate = await checkPlaygroundRateLimit(clientIp(req));
  } catch {
    return NextResponse.json(
      { error: 'Could not process the request right now. Try again shortly.' },
      { status: 500 }
    );
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Playground limit reached. Sign up for unlimited reviews.' },
      { status: 429 }
    );
  }

  const changes = diffToChanges(diff);
  if (changes.length === 0) {
    return NextResponse.json(
      { error: 'Could not find any file changes in that diff. Check that it is a unified diff.' },
      { status: 400 }
    );
  }

  try {
    const { result, filesReviewed } = await analyzeFileChanges(changes, {
      title: 'playground-session',
      author: 'playground-session',
    });

    return NextResponse.json({
      text: formatShippingBrief(result, filesReviewed),
      structuredContent: {
        summary: result.summary,
        riskLevel: result.riskLevel,
        riskFlags: result.riskFlags,
        focusAreas: result.focusAreas,
        shipDecision: result.shipDecision,
        riskyFiles: result.riskyFiles,
        verificationSteps: result.verificationSteps,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Review failed: ${message}` }, { status: 500 });
  }
}
