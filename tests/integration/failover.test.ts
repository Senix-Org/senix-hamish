import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * INTEGRATION (failover): inside the real analyze-pr orchestration, the
 * primary LLM provider throws and the next configured provider succeeds.
 * The review is still posted and saved. We mock only the provider SDKs (so
 * the real failover logic in analyzePR runs) plus the other external
 * services.
 * Proves: a single provider outage does not block reviews.
 * Failure means: provider downtime would take the whole product down.
 */

const {
  groqAnalyze, anthropicAnalyze, upsertPRComment, claimAnalysis,
  fetchPRFiles, fetchFileContent, isOverDailyCostCap,
} = vi.hoisted(() => ({
  groqAnalyze: vi.fn(),
  anthropicAnalyze: vi.fn(),
  upsertPRComment: vi.fn(),
  claimAnalysis: vi.fn(),
  fetchPRFiles: vi.fn(),
  fetchFileContent: vi.fn(),
  isOverDailyCostCap: vi.fn(),
}));

const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
function makeQuery(table: string) {
  const obj: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'not', 'order', 'limit', 'is', 'in']) obj[m] = () => obj;
  obj.update = (payload: Record<string, unknown>) => { updates.push({ table, payload }); return obj; };
  obj.maybeSingle = () => Promise.resolve(table === 'installations' ? { data: { uninstalled_at: null } } : { data: null });
  obj.single = () => Promise.resolve(table === 'pull_requests' ? { data: { title: 't', author_login: 'd' } } : { data: null });
  obj.then = (resolve: (v: { data: null; error: null }) => unknown) => resolve({ data: null, error: null });
  return obj;
}

// Mock the provider SDK modules so the REAL analyzePR failover runs.
vi.mock('@features/ai-engine/llm/groq', () => ({ GroqProvider: vi.fn(() => ({ analyzePR: groqAnalyze })) }));
vi.mock('@features/ai-engine/llm/anthropic', () => ({ AnthropicProvider: vi.fn(() => ({ analyzePR: anthropicAnalyze })) }));
vi.mock('@features/ai-engine/llm/gemini', () => ({ GeminiProvider: vi.fn(() => ({ analyzePR: vi.fn() })) }));
vi.mock('@features/ai-engine/llm/deepseek', () => ({ DeepSeekProvider: vi.fn(() => ({ analyzePR: vi.fn() })) }));

vi.mock('@features/shared/supabase', () => ({ supabaseAdmin: { from: (t: string) => makeQuery(t) } }));
vi.mock('@features/github-integration/github-diff', () => ({ fetchPRFiles, fetchFileContent }));
vi.mock('@features/ai-engine/cost-tracker', () => ({ isOverDailyCostCap }));
vi.mock('@features/github-integration/github-comments', () => ({ upsertPRComment }));
vi.mock('@features/review-queue/queue', () => ({ claimAnalysis, releaseAnalysisClaim: vi.fn() }));
vi.mock('@features/billing/plan-limits', () => ({
  isOverRepoLimit: vi.fn().mockResolvedValue(false),
  recordTokenUsage: vi.fn().mockResolvedValue(0),
  ESTIMATED_TOKENS_PER_REVIEW: 2000,
}));

import { processAnalyzePr } from '@features/review-queue/worker/analyze-pr';

const payload = {
  analysisId: 'an-2', pullRequestId: 'pr-2', userId: 'user-1', installationId: 42,
  owner: 'acme', repo: 'web', prNumber: 8, headSha: 'h', baseSha: 'b',
};

beforeEach(() => {
  updates.length = 0;
  process.env.POST_PR_COMMENTS = 'true';
  process.env.LLM_PROVIDER = 'groq';
  process.env.GROQ_API_KEY = 'k';
  process.env.ANTHROPIC_API_KEY = 'k';
  claimAnalysis.mockResolvedValue(true);
  isOverDailyCostCap.mockResolvedValue(false);
  fetchPRFiles.mockResolvedValue([{ filename: 'a.ts', status: 'modified', additions: 1, deletions: 0, changes: 1 }]);
  fetchFileContent.mockResolvedValue('export function a(){ return 1; }');
  upsertPRComment.mockResolvedValue({ commentId: 1, commentUrl: 'u' });
  groqAnalyze.mockRejectedValue(new Error('groq 503'));
  anthropicAnalyze.mockResolvedValue({
    summary: 'Recovered via failover.', riskLevel: 'low', riskFlags: [], focusAreas: [],
    shipDecision: 'safe to ship', riskyFiles: [], verificationSteps: [],
    tokensUsed: 50, costUsdCents: 1, provider: 'anthropic',
  });
});

describe('analyze-pr with provider failover', () => {
  it('falls over from the failing primary to the backup and still posts the review', async () => {
    await processAnalyzePr(payload);

    expect(groqAnalyze).toHaveBeenCalledOnce();
    expect(anthropicAnalyze).toHaveBeenCalledOnce();
    expect(upsertPRComment).toHaveBeenCalledOnce();

    const completed = updates.find((u) => u.table === 'analyses' && u.payload.status === 'completed');
    expect(completed?.payload.summary).toBe('Recovered via failover.');
    expect(completed?.payload.error_message).toBeNull();
  });
});
