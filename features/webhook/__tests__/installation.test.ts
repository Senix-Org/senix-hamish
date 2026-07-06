import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: the installation webhook handler upserts the installation and its
 * repositories on install, soft-deletes on uninstall, toggles suspend state,
 * and guards against malformed payloads (no id, missing account).
 * Failure means: installs would not register (no reviews ever run), or
 * uninstalls would not stop access.
 */

const { syncReposConnected, getUserPlan } = vi.hoisted(() => ({
  syncReposConnected: vi.fn(async () => 0),
  getUserPlan: vi.fn(async () => ({
    effectiveLimit: { repos: -1, tokens: 0, label: 'Pro' },
  })),
}));

const calls = { reposUpsert: 0, instUpsert: 0, instUpdate: 0, reposDelete: 0 };

function makeQuery(table: string) {
  const o: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in']) o[m] = () => o;
  o.delete = () => {
    if (table === 'repositories') calls.reposDelete++;
    return o;
  };
  o.update = () => {
    if (table === 'installations') calls.instUpdate++;
    return o;
  };
  o.upsert = () => {
    if (table === 'repositories') calls.reposUpsert++;
    if (table === 'installations') calls.instUpsert++;
    return o;
  };
  o.maybeSingle = () => Promise.resolve({ data: { installed_by_user_id: null } });
  o.single = () =>
    Promise.resolve(
      table === 'installations'
        ? { data: { id: 'inst-row-1', installed_by_user_id: null }, error: null }
        : { data: null, error: null }
    );
  o.then = (resolve: (v: { error: null }) => unknown) => resolve({ error: null });
  return o;
}

vi.mock('@features/shared/supabase', () => ({ supabaseAdmin: { from: (t: string) => makeQuery(t) } }));
vi.mock('@features/billing/plan-limits', () => ({ syncReposConnected, getUserPlan }));

import { handleInstallation } from '@features/webhook/handlers/installation';

beforeEach(() => {
  calls.reposUpsert = 0;
  calls.instUpsert = 0;
  calls.instUpdate = 0;
  calls.reposDelete = 0;
});

describe('handleInstallation', () => {
  it('returns no-id for a payload missing the installation id', async () => {
    expect(await handleInstallation({})).toBe('installation:no-id');
  });

  it('rejects an install payload missing account details', async () => {
    const r = await handleInstallation({ action: 'created', installation: { id: 5 } });
    expect(r).toBe('installation:missing-account:5');
    expect(calls.instUpsert).toBe(0);
  });

  it('upserts the installation and its repositories on install', async () => {
    const r = await handleInstallation({
      action: 'created',
      installation: { id: 5, account: { login: 'acme', type: 'Organization' } },
      repositories: [{ id: 1, full_name: 'acme/a' }, { id: 2, full_name: 'acme/b' }],
    });
    expect(calls.instUpsert).toBe(1);
    expect(calls.reposUpsert).toBe(1);
    expect(r).toMatch(/installation:created:5:repos\+2/);
  });

  it('soft-deletes the installation on uninstall', async () => {
    const r = await handleInstallation({ action: 'deleted', installation: { id: 5 } });
    expect(calls.instUpdate).toBeGreaterThanOrEqual(1);
    expect(r).toBe('installation:deleted:5');
  });

  it('toggles the suspended flag on suspend', async () => {
    const r = await handleInstallation({ action: 'suspend', installation: { id: 5 } });
    expect(calls.instUpdate).toBe(1);
    expect(r).toBe('installation:suspend:5');
  });
});
