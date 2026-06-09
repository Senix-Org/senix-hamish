import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * INTEGRATION (plan limit): a PR arrives for a user who has hit their
 * monthly review limit. The handler must NOT enqueue an analysis; instead it
 * posts the "limit reached" comment and returns a limit-reached result.
 * Proves: plan limits actually gate the expensive path with a clear message.
 * Failure means: free users could exceed limits and consume paid capacity.
 */

const { checkReviewLimit, upsertPRComment, enqueue, findRepository } = vi.hoisted(() => ({
  checkReviewLimit: vi.fn(),
  upsertPRComment: vi.fn(),
  enqueue: vi.fn(),
  findRepository: vi.fn(),
}));

function makeQuery() {
  const obj: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'not', 'order', 'limit', 'insert', 'upsert']) obj[m] = () => obj;
  obj.single = () => Promise.resolve({ data: { id: 'pr-row-1' }, error: null });
  obj.maybeSingle = () => Promise.resolve({ data: null });
  obj.then = (resolve: (v: { data: null; error: null }) => unknown) => resolve({ data: null, error: null });
  return obj;
}

vi.mock('@features/billing/plan-limits', () => ({ checkReviewLimit }));
vi.mock('@features/github-integration/github-comments', () => ({ upsertPRComment }));
vi.mock('@features/review-queue/queue', () => ({ enqueue }));
vi.mock('@features/webhook/handlers/lookup', () => ({ findRepository }));
vi.mock('@features/shared/supabase', () => ({ supabaseAdmin: { from: () => makeQuery() } }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p: unknown) => p }));

import { handlePullRequest } from '@features/webhook/handlers/pull-request';

const payload = {
  action: 'opened',
  pull_request: { number: 7, id: 999, title: 'x', user: { login: 'dev' }, state: 'open', head: { sha: 'h' }, base: { sha: 'b' } },
  repository: { id: 123 },
  installation: { id: 42 },
};

beforeEach(() => {
  enqueue.mockReset().mockResolvedValue('job-1');
  upsertPRComment.mockReset().mockResolvedValue({ commentId: 1, commentUrl: 'u' });
  findRepository.mockResolvedValue({
    id: 'repo-1', full_name: 'acme/web', enabled: true,
    installations: { installed_by_user_id: 'user-1' },
  });
});

describe('handlePullRequest at plan limit', () => {
  it('blocks the review, posts a limit-reached comment, and does not enqueue', async () => {
    checkReviewLimit.mockResolvedValue({ allowed: false, reason: 'Monthly review limit reached for the Free plan.' });

    const result = await handlePullRequest(payload);

    expect(result).toMatch(/limit-reached/);
    expect(enqueue).not.toHaveBeenCalled();
    expect(upsertPRComment).toHaveBeenCalledOnce();
    const body = upsertPRComment.mock.calls[0][0].commentBody as string;
    expect(body).toMatch(/reached your Senix review limit/i);
    expect(body).toMatch(/dashboard\/billing/);
  });

  it('proceeds to dispatch when under the limit', async () => {
    checkReviewLimit.mockResolvedValue({ allowed: true });
    process.env.NEXT_PUBLIC_SITE_URL = '';
    process.env.INTERNAL_WORKER_SECRET = '';

    const result = await handlePullRequest(payload);
    // With no serverless URL configured it falls back to the Redis queue.
    expect(enqueue).toHaveBeenCalledOnce();
    expect(result).toMatch(/queued/);
  });
});
