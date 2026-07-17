import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves the Workflows execution path: steps run in pipeline order with the
 * shared step functions, a preflight that declines to proceed short-circuits
 * everything downstream, the comment step is skipped when the LLM produced
 * nothing, and a step failure marks the analysis failed (without clobbering
 * terminal states) and rethrows so the instance reports as failed.
 * Failure means: the production analysis path would run steps out of order,
 * double-run side effects, or strand rows exactly like the waitUntil bug.
 */

const h = vi.hoisted(() => ({
  calls: [] as string[],
  preflight: vi.fn(),
  buildDiff: vi.fn(),
  runLlm: vi.fn(),
  postComment: vi.fn(),
  finalize: vi.fn(),
  trueUp: vi.fn(),
  releaseClaim: vi.fn(async () => undefined),
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {
    env: Record<string, unknown> = {};
  },
}));

vi.mock('@features/review-queue/workflow/steps', () => ({
  preflightAnalysis: h.preflight,
  buildDiffSummary: h.buildDiff,
  runLlmAnalysis: h.runLlm,
  postAnalysisComment: h.postComment,
  finalizeAnalysis: h.finalize,
  trueUpTokenUsage: h.trueUp,
}));

vi.mock('@features/review-queue/queue', () => ({
  releaseAnalysisClaim: h.releaseClaim,
}));

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      update: (payload: Record<string, unknown>) => ({
        eq: () => ({
          in: () => {
            h.updates.push(payload);
            return Promise.resolve({ error: null });
          },
        }),
      }),
    }),
  },
}));

import { AnalyzePrWorkflow } from '@features/review-queue/workflow/analyze-pr-workflow';

const job = {
  analysisId: 'a1',
  pullRequestId: 'pr1',
  userId: 'u1',
  installationId: 1,
  owner: 'o',
  repo: 'r',
  prNumber: 5,
  headSha: 'h',
  baseSha: 'b',
};

// A WorkflowStep stand-in that records step names and runs callbacks inline.
function fakeStep() {
  return {
    do: async (name: string, _cfgOrCb: unknown, maybeCb?: () => Promise<unknown>) => {
      h.calls.push(name);
      const cb = (typeof _cfgOrCb === 'function' ? _cfgOrCb : maybeCb) as () => Promise<unknown>;
      return cb();
    },
    sleep: async () => undefined,
  };
}

function instance() {
  const wf = new AnalyzePrWorkflow() as unknown as {
    env: Record<string, unknown>;
    run(event: { payload: typeof job }, step: unknown): Promise<void>;
  };
  wf.env = {};
  return wf;
}

beforeEach(() => {
  h.calls.length = 0;
  h.updates.length = 0;
  vi.clearAllMocks();
  h.preflight.mockResolvedValue({ proceed: true, prTitle: 't', prAuthor: 'a' });
  h.buildDiff.mockResolvedValue({ fileCount: 1, structural: [] });
  h.runLlm.mockResolvedValue({ llmResult: { tokensUsed: 10 }, llmError: null });
  h.postComment.mockResolvedValue({ commentId: 9, commentUrl: 'u', postError: null });
  h.finalize.mockResolvedValue(undefined);
  h.trueUp.mockResolvedValue(undefined);
});

describe('AnalyzePrWorkflow', () => {
  it('runs the pipeline steps in order', async () => {
    await instance().run({ payload: job }, fakeStep());

    expect(h.calls).toEqual([
      'preflight',
      'build-structural-diff',
      'llm-analysis',
      'post-pr-comment',
      'finalize-analysis',
      'true-up-token-usage',
    ]);
    expect(h.postComment).toHaveBeenCalledWith(job, { tokensUsed: 10 });
  });

  it('stops after preflight when it declines to proceed', async () => {
    h.preflight.mockResolvedValue({ proceed: false, skippedReason: 'already claimed' });

    await instance().run({ payload: job }, fakeStep());

    expect(h.calls).toEqual(['preflight']);
    expect(h.buildDiff).not.toHaveBeenCalled();
  });

  it('skips the comment step when the LLM produced no result', async () => {
    h.runLlm.mockResolvedValue({ llmResult: null, llmError: 'all providers failed' });

    await instance().run({ payload: job }, fakeStep());

    expect(h.calls).not.toContain('post-pr-comment');
    expect(h.postComment).not.toHaveBeenCalled();
    // Finalize still runs so the structural diff persists with the error.
    expect(h.finalize).toHaveBeenCalled();
  });

  it('marks the analysis failed, releases the claim, and rethrows on step failure', async () => {
    h.buildDiff.mockRejectedValue(new Error('github 502'));

    await expect(instance().run({ payload: job }, fakeStep())).rejects.toThrow('github 502');

    expect(h.calls).toContain('mark-analysis-failed');
    expect(h.updates[0]).toMatchObject({ status: 'failed', error_message: 'github 502' });
    expect(h.releaseClaim).toHaveBeenCalledWith('a1');
    expect(h.finalize).not.toHaveBeenCalled();
  });
});
