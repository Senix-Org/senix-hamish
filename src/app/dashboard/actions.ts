'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { supabaseAdmin } from '@features/shared/supabase';
import { checkRepoLimit } from '@features/billing/plan-limits';

type ToggleResult = { ok: true; enabled: boolean } | { ok: false; error: string };

type RepoOwnershipRow = {
  id: string;
  enabled: boolean;
  installations: {
    installed_by_user_id: string | null;
  } | null;
};

type AppUserRow = { id: string };

/**
 * Flip `repositories.enabled` for one repo. Verifies that the signed-in
 * user owns the installation that owns the repo before mutating, so the
 * caller can pass any repoId without a RLS round-trip.
 */
export async function toggleRepoEnabled(repoId: string): Promise<ToggleResult> {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, error: 'Not signed in.' };
  }

  const { data: appUser } = (await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()) as unknown as { data: AppUserRow | null };
  if (!appUser) {
    return { ok: false, error: 'No linked user record.' };
  }

  const { data: repo } = (await supabaseAdmin
    .from('repositories')
    .select('id, enabled, installations(installed_by_user_id)')
    .eq('id', repoId)
    .maybeSingle()) as unknown as { data: RepoOwnershipRow | null };

  if (!repo || repo.installations?.installed_by_user_id !== appUser.id) {
    return { ok: false, error: 'Repo not found.' };
  }

  const nextEnabled = !repo.enabled;

  // GAP 1: enabling a repo must respect the plan's repo cap. (Disabling is
  // always allowed so users can get back under their limit.)
  if (nextEnabled) {
    const limit = await checkRepoLimit(appUser.id);
    if (!limit.allowed) {
      return {
        ok: false,
        error: "You've reached your repo limit. Upgrade to connect more repos.",
      };
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('repositories')
    .update({ enabled: nextEnabled })
    .eq('id', repo.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath('/dashboard');
  return { ok: true, enabled: nextEnabled };
}
