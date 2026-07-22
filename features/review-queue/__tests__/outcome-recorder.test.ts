import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: a merged PR labels its latest completed review — developer_shipped
 * reflects merging despite a high/critical verdict, the 24h hotfix scan is
 * scheduled, synchronize events increment the pushback counter, and a PR
 * with no completed review writes nothing. All paths are best-effort: a DB
 * failure logs and never throws into the webhook handler.
 * Failure means: the outcome training dataset would be mislabeled or
 * outcome bookkeeping could break webhook processing.
 */

const state = vi.hoisted(() => ({
  repoRow: { id: 'repo-1' } as { id: string } | null,
  prRow: { id: 'pr-1' } as { id: string } | null,
  analysisRow: {
    id: 'an-1',
    risk_level: 'high',
    commits_after_review: 0,
  } as Record<string, unknown> | null,
  updates: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  failUpdate: false,
}));

function makeQuery(table: string) {
  const o: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'not', 'is', 'lte']) o[m] = () => o;
  o.update = (payload: Record<string, unknown>) => {
    state.updates.push({ table, payload });
    return {
      eq: () =>
        Promise.resolve(state.failUpdate ? { error: { message: 'db down' } } : { error: null }),
    };
  };
  o.maybeSingle = () =>
    Promise.resolve({
      data:
        table === 'repositories'
          ? state.repoRow
          : table === 'pull_requests'
            ? state.prRow
            : state.analysisRow,
    });
  return o;
}

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: { from: (t: string) => makeQuery(t) },
}));

import { recordPROutcome, incrementCommitsAfterReview } from '@features/review-queue/outcome-recorder';

beforeEach(() => {
  state.repoRow = { id: 'repo-1' };
  state.prRow = { id: 'pr-1' };
  state.analysisRow = { id: 'an-1', risk_level: 'high', commits_after_review: 0 };
  state.updates.length = 0;
  state.failUpdate = false;
});

describe('recordPROutcome', () => {
  it('labels a merge despite a high-risk verdict and schedules the hotfix scan', async () => {
    const mergedAt = '2026-07-06T12:00:00.000Z';
    await recordPROutcome({
      prNumber: 7,
      repoFullName: 'acme/app',
      merged: true,
      mergedAt,
      closedAt: mergedAt,
    });

    expect(state.updates).toHaveLength(1);
    const update = state.updates[0].payload;
    expect(update.developer_shipped).toBe(true);
    expect(update.pr_merged_at).toBe(mergedAt);
    // Hotfix scan due exactly 24h after the merge.
    expect(update.hotfix_check_after).toBe('2026-07-07T12:00:00.000Z');
    expect(update.outcome_recorded_at).toBeTruthy();
  });

  it('records developer_shipped=false when a low-risk PR merges', async () => {
    state.analysisRow = { id: 'an-1', risk_level: 'low', commits_after_review: 0 };
    await recordPROutcome({
      prNumber: 7,
      repoFullName: 'acme/app',
      merged: true,
      mergedAt: '2026-07-06T12:00:00.000Z',
      closedAt: null,
    });
    expect(state.updates[0].payload.developer_shipped).toBe(false);
  });

  it('records only the close on an unmerged close (no merge fields, no hotfix scan)', async () => {
    await recordPROutcome({
      prNumber: 7,
      repoFullName: 'acme/app',
      merged: false,
      mergedAt: null,
      closedAt: '2026-07-06T13:00:00.000Z',
    });
    const update = state.updates[0].payload;
    expect(update.pr_closed_at).toBe('2026-07-06T13:00:00.000Z');
    expect(update.developer_shipped).toBeUndefined();
    expect(update.hotfix_check_after).toBeUndefined();
  });

  it('writes nothing when the PR has no completed review', async () => {
    state.analysisRow = null;
    await recordPROutcome({
      prNumber: 7,
      repoFullName: 'acme/app',
      merged: true,
      mergedAt: '2026-07-06T12:00:00.000Z',
      closedAt: null,
    });
    expect(state.updates).toHaveLength(0);
  });

  it('never throws on a database failure (best-effort)', async () => {
    state.failUpdate = true;
    await expect(
      recordPROutcome({
        prNumber: 7,
        repoFullName: 'acme/app',
        merged: true,
        mergedAt: '2026-07-06T12:00:00.000Z',
        closedAt: null,
      })
    ).resolves.toBeUndefined();
  });
});

describe('incrementCommitsAfterReview', () => {
  it('increments the pushback counter on the latest completed review', async () => {
    state.analysisRow = { id: 'an-1', risk_level: 'high', commits_after_review: 2 };
    await incrementCommitsAfterReview({ prNumber: 7, repoFullName: 'acme/app' });
    expect(state.updates[0].payload).toEqual({ commits_after_review: 3 });
  });

  it('writes nothing when no completed review exists yet', async () => {
    state.analysisRow = null;
    await incrementCommitsAfterReview({ prNumber: 7, repoFullName: 'acme/app' });
    expect(state.updates).toHaveLength(0);
  });
});
