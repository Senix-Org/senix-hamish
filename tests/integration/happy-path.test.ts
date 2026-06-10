import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * INTEGRATION (happy path): an analyze-pr job runs end to end. We exercise
 * the real orchestration in processAnalyzePr (claim, fetch diff, build
 * structural diff, call the LLM, post the comment, persist the result) with
 * only the external services mocked (Supabase, GitHub, Upstash, LLM).
 * Proves: webhook -> queue -> AI review -> PR comment posted, result saved.
 * Failure means: the core product flow is broken somewhere in the chain.
 */

const { upsertPRComment, analyzePR, claimAnalysis, fetchPRFiles, fetchFileContent, isOverDailyCostCap } =
  vi.hoisted(() => ({
    upsertPRComment: vi.fn(),
    analyzePR: vi.fn(),
    claimAnalysis: vi.fn(),
    fetchPRFiles: vi.fn(),
    fetchFileContent: vi.fn(),
    isOverDailyCostCap: vi.fn(),
  }));

const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

function makeQuery(table: string) {
  const obj: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'not', 'order', 'limit', 'is']) obj[m] = () => obj;
  obj.update = (payload: Record<string, unknown>) => {
    updates.push({ table, payload });
    return obj;
  };
  obj.maybeSingle = () =>
    Promise.resolve(
      table === 'installations'
        ? { data: { uninstalled_at: null } }
        : { data: null }
    );
  obj.single = () =>
    Promise.resolve(
      table === 'pull_requests'
        ? { data: { title: 'Add login', author_login: 'dev' } }
        : { data: null }
    );
  obj.then = (resolve: (v: { data: null; error: null }) => unknown) =>
    resolve({ data: null, error: null });
  return obj;
}

vi.mock('@features/shared/supabase', () => ({ supabaseAdmin: { from: (t: string) => makeQuery(t) } }));
vi.mock('@features/github-integration/github-diff', () => ({ fetchPRFiles, fetchFileContent }));
vi.mock('@features/ai-engine/llm', () => ({ analyzePR }));
vi.mock('@features/ai-engine/cost-tracker', () => ({ isOverDailyCostCap }));
vi.mock('@features/github-integration/github-comments', () => ({ upsertPRComment }));
vi.mock('@features/review-queue/queue', () => ({ claimAnalysis }));
vi.mock('@features/billing/plan-limits', () => ({
  isOverRepoLimit: vi.fn().mockResolvedValue(false),
  recordTokenUsage: vi.fn().mockResolvedValue(0),
}));

import { processAnalyzePr } from '@features/review-queue/worker/analyze-pr';

const payload = {
  analysisId: 'an-1', pullRequestId: 'pr-1', userId: 'user-1', installationId: 42,
  owner: 'acme', repo: 'web', prNumber: 7, headSha: 'head', baseSha: 'base',
};

beforeEach(() => {
  updates.length = 0;
  process.env.POST_PR_COMMENTS = 'true';
  claimAnalysis.mockResolvedValue(true);
  isOverDailyCostCap.mockResolvedValue(false);
  fetchPRFiles.mockResolvedValue([
    { filename: 'auth.ts', status: 'modified', additions: 5, deletions: 1, changes: 6 },
  ]);
  fetchFileContent
    .mockResolvedValueOnce('export function login(u){ return u; }')
    .mockResolvedValueOnce('export function login(u){ if(!u) throw new Error("no user"); return u; }');
  analyzePR.mockResolvedValue({
    summary: 'Adds a null check to login.', riskLevel: 'low', riskFlags: [], focusAreas: [],
    shipDecision: 'safe to ship', riskyFiles: [], verificationSteps: [],
    tokensUsed: 100, costUsdCents: 2, provider: 'groq',
  });
  upsertPRComment.mockResolvedValue({ commentId: 555, commentUrl: 'https://gh/c/555' });
});

describe('analyze-pr happy path', () => {
  it('claims, analyzes, posts the PR comment, and saves a completed analysis', async () => {
    await processAnalyzePr(payload);

    // AI review generated and a single PR comment posted (not duplicated).
    expect(analyzePR).toHaveBeenCalledOnce();
    expect(upsertPRComment).toHaveBeenCalledOnce();

    // Result persisted as completed with the summary and comment id.
    const completed = updates.find(
      (u) => u.table === 'analyses' && u.payload.status === 'completed'
    );
    expect(completed?.payload.summary).toBe('Adds a null check to login.');
    expect(completed?.payload.github_comment_id).toBe(555);
    expect(completed?.payload.error_message).toBeNull();
  });

  it('does not re-process when the analysis is already claimed (exactly once)', async () => {
    claimAnalysis.mockResolvedValue(false);
    await processAnalyzePr(payload);
    expect(analyzePR).not.toHaveBeenCalled();
    expect(upsertPRComment).not.toHaveBeenCalled();
  });
});
