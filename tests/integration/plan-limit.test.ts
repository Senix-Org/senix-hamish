import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * INTEGRATION (plan limit): a PR arrives for a user who has hit their
 * monthly review limit. The handler must NOT dispatch an analysis; instead
 * it posts the "limit reached" comment and returns a limit-reached result.
 * Proves: plan limits actually gate the expensive path with a clear message.
 * Failure means: free users could exceed limits and consume paid capacity.
 */

const {
  checkTokenLimit,
  upsertPRComment,
  enqueue,
  findRepository,
  processAnalyzePr,
  afterCallbacks,
} = vi.hoisted(() => ({
  checkTokenLimit: vi.fn(),
  upsertPRComment: vi.fn(),
  enqueue: vi.fn(),
  findRepository: vi.fn(),
  processAnalyzePr: vi.fn(),
  afterCallbacks: [] as Array<() => Promise<void>>,
}));

function makeQuery() {
  const obj: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'not', 'order', 'limit', 'insert', 'upsert']) obj[m] = () => obj;
  obj.single = () => Promise.resolve({ data: { id: 'pr-row-1' }, error: null });
  obj.maybeSingle = () => Promise.resolve({ data: null });
  obj.then = (resolve: (v: { data: null; error: null }) => unknown) => resolve({ data: null, error: null });
  return obj;
}

vi.mock('@features/billing/plan-limits', () => ({ checkTokenLimit }));
vi.mock('@features/github-integration/github-comments', () => ({ upsertPRComment }));
vi.mock('@features/review-queue/queue', () => ({ enqueue }));
vi.mock('@features/webhook/handlers/lookup', () => ({ findRepository }));
vi.mock('@features/shared/supabase', () => ({ supabaseAdmin: { from: () => makeQuery() } }));
vi.mock('@features/review-queue/worker/analyze-pr', () => ({ processAnalyzePr }));
// The analysis now runs in a Next.js after() callback instead of a
// waitUntil() fetch. Capture the callback so tests can flush it and assert
// on the background work.
vi.mock('next/server', () => ({
  after: (cb: () => Promise<void>) => {
    afterCallbacks.push(cb);
  },
}));

async function flushAfter(): Promise<void> {
  for (const cb of afterCallbacks.splice(0)) await cb();
}

import { handlePullRequest } from '@features/webhook/handlers/pull-request';

const payload = {
  action: 'opened',
  pull_request: { number: 7, id: 999, title: 'x', user: { login: 'dev' }, state: 'open', head: { sha: 'h' }, base: { sha: 'b' } },
  repository: { id: 123 },
  installation: { id: 42 },
};

beforeEach(() => {
  afterCallbacks.length = 0;
  enqueue.mockReset().mockResolvedValue('job-1');
  processAnalyzePr.mockReset().mockResolvedValue(undefined);
  upsertPRComment.mockReset().mockResolvedValue({ commentId: 1, commentUrl: 'u' });
  findRepository.mockResolvedValue({
    id: 'repo-1', full_name: 'acme/web', enabled: true,
    installations: { installed_by_user_id: 'user-1' },
  });
});

describe('handlePullRequest at plan limit', () => {
  it('blocks the review, posts a limit-reached comment, and does not dispatch', async () => {
    checkTokenLimit.mockResolvedValue({ allowed: false, reason: 'Monthly token budget reached for the Free plan.' });

    const result = await handlePullRequest(payload);

    expect(result).toMatch(/limit-reached/);
    expect(afterCallbacks).toHaveLength(0);
    expect(processAnalyzePr).not.toHaveBeenCalled();
    expect(upsertPRComment).toHaveBeenCalledOnce();
    const body = upsertPRComment.mock.calls[0][0].commentBody as string;
    expect(body).toMatch(/token budget/i);
    expect(body).toMatch(/dashboard\/billing/);
  });

  it('dispatches the analysis in the background when under the limit', async () => {
    checkTokenLimit.mockResolvedValue({ allowed: true });

    const result = await handlePullRequest(payload);
    expect(result).toMatch(/after-dispatched/);

    await flushAfter();
    expect(processAnalyzePr).toHaveBeenCalledOnce();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('falls back to the Redis queue if the background run throws', async () => {
    checkTokenLimit.mockResolvedValue({ allowed: true });
    processAnalyzePr.mockRejectedValue(new Error('analysis boom'));

    await handlePullRequest(payload);
    await flushAfter();

    expect(processAnalyzePr).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledOnce();
  });
});
