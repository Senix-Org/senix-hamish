import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves GAP 1: enabling a repo from the dashboard respects the plan's repo
 * cap. When the user is at their limit, toggling a paused repo back ON is
 * rejected and the repository row is NOT updated. Disabling is unaffected.
 */

const { getUser, checkRepoLimit, updateSpy } = vi.hoisted(() => ({
  getUser: vi.fn(),
  checkRepoLimit: vi.fn(),
  updateSpy: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@features/shared/supabase-server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser } }),
}));
vi.mock('@features/billing/plan-limits', () => ({ checkRepoLimit }));

// supabaseAdmin: users lookup -> app user; repositories lookup -> a paused
// repo owned by that user; update -> spy so we can assert it never runs.
vi.mock('@features/shared/supabase', () => {
  function from(table: string) {
    const obj: Record<string, unknown> = {};
    obj.select = () => obj;
    obj.eq = () => obj;
    obj.update = (...args: unknown[]) => {
      updateSpy(...args);
      return { eq: () => Promise.resolve({ error: null }) };
    };
    obj.maybeSingle = () =>
      Promise.resolve(
        table === 'users'
          ? { data: { id: 'user-1' } }
          : { data: { id: 'repo-1', enabled: false, installations: { installed_by_user_id: 'user-1' } } }
      );
    return obj;
  }
  return { supabaseAdmin: { from } };
});

import { toggleRepoEnabled } from '@/app/dashboard/actions';

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } });
  checkRepoLimit.mockReset();
  updateSpy.mockReset();
});

describe('toggleRepoEnabled repo-limit enforcement', () => {
  it('blocks enabling a repo when over the repo limit and does not update', async () => {
    checkRepoLimit.mockResolvedValue({ allowed: false, reason: 'Repo limit reached for the Free plan.' });

    const result = await toggleRepoEnabled('repo-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/repo limit/i);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('allows enabling when under the repo limit', async () => {
    checkRepoLimit.mockResolvedValue({ allowed: true });

    const result = await toggleRepoEnabled('repo-1');

    expect(result.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({ enabled: true });
  });
});
