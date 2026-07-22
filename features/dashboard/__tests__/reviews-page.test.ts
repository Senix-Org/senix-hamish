import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves the reviews list deduplicates multiple analyses for the same PR and
 * keeps only the latest one, so a PR does not appear twice after reopen or
 * synchronize events. Failure means: the dashboard shows duplicate rows for
 * the same pull request.
 */

const { fromSpy } = vi.hoisted(() => ({ fromSpy: vi.fn() }));

let analysesRows: unknown[] = [];

function makeBuilder() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.order = () => b;
  b.limit = () => b;
  b.eq = () => b;
  b.then = (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: analysesRows });
  return b;
}

vi.mock('@features/shared/supabase-server', () => ({
  createServerSupabaseClient: async () => ({
    from: (t: string) => {
      fromSpy(t);
      return makeBuilder();
    },
  }),
}));

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: new Proxy({}, { get() { throw new Error('dashboard must not use supabaseAdmin (RLS bypass)'); } }),
}));

import ReviewsPage from '@/app/dashboard/reviews/page';

function findAnalysesProp(node: unknown): Array<{ id: string; pr_number: number | null }> | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findAnalysesProp(child);
      if (found) return found;
    }
    return undefined;
  }
  const props = (node as { props?: { analyses?: unknown; children?: unknown } }).props;
  if (props) {
    if (Array.isArray(props.analyses)) return props.analyses as Array<{ id: string; pr_number: number | null }>;
    return findAnalysesProp(props.children);
  }
  return undefined;
}

beforeEach(() => {
  fromSpy.mockClear();
  analysesRows = [];
});

function makeAnalysis(
  id: string,
  pullRequestId: string,
  prNumber: number,
  createdAt: string,
  riskLevel: string | null = 'low'
): unknown {
  return {
    id,
    pull_request_id: pullRequestId,
    status: 'completed',
    summary: `summary-${id}`,
    risk_level: riskLevel,
    created_at: createdAt,
    completed_at: createdAt,
    error_message: null,
    github_comment_url: null,
    pull_requests: {
      id: pullRequestId,
      github_pr_number: prNumber,
      title: `PR ${prNumber}`,
      repositories: { full_name: 'acme/web' },
    },
  };
}

describe('ReviewsPage deduplication', () => {
  it('keeps only the latest analysis per pull request', async () => {
    const t1 = new Date('2026-07-20T10:00:00Z').toISOString();
    const t2 = new Date('2026-07-20T11:00:00Z').toISOString();
    analysesRows = [
      makeAnalysis('a1', 'pr-22', 22, t1, 'low'),
      makeAnalysis('a2', 'pr-22', 22, t2, 'high'),
      makeAnalysis('a3', 'pr-23', 23, t1, 'medium'),
    ];

    const el = await ReviewsPage();
    const cards = findAnalysesProp(el);

    expect(cards?.map((c) => ({ id: c.id, pr_number: c.pr_number }))).toEqual([
      { id: 'a2', pr_number: 22 },
      { id: 'a3', pr_number: 23 },
    ]);
  });

  it('drops orphaned analyses with no pull_request_id', async () => {
    analysesRows = [
      {
        id: 'a1',
        pull_request_id: null,
        status: 'completed',
        summary: 'summary',
        risk_level: 'low',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: null,
        github_comment_url: null,
        pull_requests: null,
      },
    ];

    const el = await ReviewsPage();
    const cards = findAnalysesProp(el);
    expect(cards).toBeUndefined();
  });
});
