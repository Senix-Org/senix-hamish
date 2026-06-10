import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: the repo toggle requires a signed-in user, refuses to toggle a
 * repo owned by ANOTHER user (tenant isolation), and persists the flipped
 * value for the rightful owner.
 * Failure means: a user could enable/disable another tenant's repositories,
 * or toggles would silently not save.
 */

const { getUser, maybeSingle, update, revalidatePath, checkRepoLimit } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
  revalidatePath: vi.fn(),
  checkRepoLimit: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));
// Repo-limit enforcement is covered in repo-toggle-limit.test.ts; here we
// isolate the ownership/persistence logic by allowing the budget check.
vi.mock('@features/billing/plan-limits', () => ({ checkRepoLimit }));
vi.mock('@features/shared/supabase-server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock('@features/shared/supabase', () => {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = maybeSingle;
  builder.update = update;
  return { supabaseAdmin: { from: () => builder } };
});

import { toggleRepoEnabled } from '@/app/dashboard/actions';

beforeEach(() => {
  getUser.mockReset();
  maybeSingle.mockReset();
  update.mockClear();
  checkRepoLimit.mockReset().mockResolvedValue({ allowed: true });
});

describe('toggleRepoEnabled', () => {
  it('rejects when the user is not signed in', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await toggleRepoEnabled('repo-1');
    expect(res).toMatchObject({ ok: false });
  });

  it("refuses to toggle a repo owned by another user (tenant isolation)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'auth-me' } } });
    maybeSingle
      .mockResolvedValueOnce({ data: { id: 'me' } }) // app user
      .mockResolvedValueOnce({
        data: { id: 'repo-1', enabled: false, installations: { installed_by_user_id: 'someone-else' } },
      });
    const res = await toggleRepoEnabled('repo-1');
    expect(res).toEqual({ ok: false, error: 'Repo not found.' });
    expect(update).not.toHaveBeenCalled();
  });

  it('flips and persists the value for the rightful owner', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'auth-me' } } });
    maybeSingle
      .mockResolvedValueOnce({ data: { id: 'me' } })
      .mockResolvedValueOnce({
        data: { id: 'repo-1', enabled: false, installations: { installed_by_user_id: 'me' } },
      });
    const res = await toggleRepoEnabled('repo-1');
    expect(res).toEqual({ ok: true, enabled: true });
    expect(update).toHaveBeenCalledWith({ enabled: true });
  });
});
