import { NextRequest, NextResponse } from 'next/server';
import { analyzeFileChanges, formatShippingBrief } from '@features/ai-engine/analyze-changes';
import { diffToChanges } from '@features/ai-engine/diff-to-changes';
import {
  checkPlaygroundTokenBudget,
  clientIp,
  recordPlaygroundTokens,
} from '@features/billing/playground-rate-limit';
import { currentAppUserId } from '@features/auth/mcp-tokens';
import { checkTokenLimit, recordTokenUsage } from '@features/billing/plan-limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/playground/review
 *
 * Accepts a unified git diff, parses it into file changes, and runs the same
 * analysis pipeline the MCP `review_changes` tool uses. Anonymous callers are
 * bounded by a per-IP daily token budget; signed-in callers spend against
 * their monthly plan token budget. A 50 KB diff cap protects either path.
 *
 * Request body:  { "diff": "<unified diff string>" }
 * Response body: { "text": "<shipping brief>", "structuredContent": { ... } }
 */

const MAX_DIFF_BYTES = 50 * 1024;
// Conservative up-front estimate; the real token count is recorded after the
// LLM responds.
const ESTIMATED_TOKENS_PER_REVIEW = 2000;

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

  // Identify the caller: signed-in users spend their monthly budget, anonymous
  // users are bounded per-IP. Budget pre-check before any expensive work; fail
  // closed on a counter error so an outage cannot become a free LLM path.
  const userId = await currentAppUserId();
  const ip = clientIp(req);

  try {
    if (userId) {
      const budget = await checkTokenLimit(userId, ESTIMATED_TOKENS_PER_REVIEW, 'playground');
      if (!budget.allowed) {
        return NextResponse.json(
          { error: 'Monthly token budget reached. Upgrade your plan to keep reviewing.' },
          { status: 402 }
        );
      }
    } else {
      const budget = await checkPlaygroundTokenBudget(ip);
      if (!budget.allowed) {
        return NextResponse.json(
          { error: "You've used your free token allowance for today. Sign up for more." },
          { status: 429 }
        );
      }
    }
  } catch {
    return NextResponse.json(
      { error: 'Could not process the request right now. Try again shortly.' },
      { status: 500 }
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

    // Record actual token usage. Best-effort: never fail the response the
    // caller already earned over a usage-bookkeeping error.
    try {
      if (userId) {
        await recordTokenUsage(userId, result.tokensUsed, 'playground');
      } else {
        await recordPlaygroundTokens(ip, result.tokensUsed);
      }
    } catch (usageErr) {
      console.error('[playground] failed to record token usage', usageErr);
    }

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
