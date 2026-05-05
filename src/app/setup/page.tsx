import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = {
  installation_id?: string;
  setup_action?: string;
};

type UserRow = {
  id: string;
  auth_user_id: string;
};

type InstallationRow = {
  id: string;
  github_installation_id: number;
  account_login: string;
  installed_by_user_id: string | null;
};

/**
 * Post-install landing page. GitHub redirects the user here with
 * `?installation_id=...&setup_action=...` after the App is installed (or
 * the install is updated). We:
 *   1. Force the user to be signed in.
 *   2. Ensure a `users` row exists for the current Supabase auth user.
 *   3. Stamp `installations.installed_by_user_id` on the matching row.
 *   4. Show a confirmation card with a link to the dashboard.
 */
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const installationId = params.installation_id ? Number(params.installation_id) : null;

  if (!installationId || Number.isNaN(installationId)) {
    return renderError('Missing or invalid installation_id in the URL.');
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect(`/login?next=/setup&installation_id=${installationId}`);
  }

  const userRow = await ensureUserRow(authData.user);
  const installation = await linkInstallationToUser(installationId, userRow.id);

  if (!installation) {
    return renderError(
      'We could not find that installation in our database yet. ' +
        'GitHub webhooks usually arrive within a few seconds — refresh this page in a moment.'
    );
  }

  const repoCount = await countReposForInstallation(installation.id);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-zinc-800 bg-zinc-900/40 p-8">
        <div className="text-green-400 text-xs font-bold uppercase tracking-wide mb-2">
          Connected
        </div>
        <h1 className="text-2xl font-bold mb-3">Senix is now connected to {installation.account_login}.</h1>
        <p className="text-zinc-400 mb-6 leading-relaxed">
          You&apos;ll see analyses on every PR opened in {repoCount}{' '}
          {repoCount === 1 ? 'repo' : 'repos'}.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-medium transition"
        >
          View dashboard →
        </Link>
      </div>
    </main>
  );
}

async function ensureUserRow(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Promise<UserRow> {
  const meta = authUser.user_metadata ?? {};
  const githubUsername =
    (meta.user_name as string | undefined) ?? (meta.preferred_username as string | undefined) ?? null;
  const providerIdRaw = (meta.provider_id as string | number | undefined) ?? null;
  const githubUserId =
    typeof providerIdRaw === 'string' ? Number(providerIdRaw) : (providerIdRaw as number | null);

  const { data: existing } = (await supabaseAdmin
    .from('users')
    .select('id, auth_user_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()) as unknown as { data: UserRow | null };

  if (existing) {
    return existing;
  }

  const { data: inserted, error } = (await supabaseAdmin
    .from('users')
    .insert({
      auth_user_id: authUser.id,
      github_username: githubUsername,
      github_user_id: githubUserId,
      email: authUser.email ?? null,
    })
    .select('id, auth_user_id')
    .single()) as unknown as { data: UserRow | null; error: { message: string } | null };

  if (error || !inserted) {
    throw new Error(`Failed to create user row: ${error?.message ?? 'unknown error'}`);
  }
  return inserted;
}

async function linkInstallationToUser(
  githubInstallationId: number,
  userId: string
): Promise<InstallationRow | null> {
  const { data: installation } = (await supabaseAdmin
    .from('installations')
    .select('id, github_installation_id, account_login, installed_by_user_id')
    .eq('github_installation_id', githubInstallationId)
    .maybeSingle()) as unknown as { data: InstallationRow | null };

  if (!installation) {
    return null;
  }

  if (installation.installed_by_user_id !== userId) {
    await supabaseAdmin
      .from('installations')
      .update({ installed_by_user_id: userId })
      .eq('id', installation.id);
    installation.installed_by_user_id = userId;
  }

  return installation;
}

async function countReposForInstallation(installationId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('repositories')
    .select('*', { count: 'exact', head: true })
    .eq('installation_id', installationId);
  return count ?? 0;
}

function renderError(message: string): React.ReactElement {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-zinc-800 bg-zinc-900/40 p-8">
        <div className="text-red-400 text-xs font-bold uppercase tracking-wide mb-2">
          Setup error
        </div>
        <p className="text-zinc-300 leading-relaxed">{message}</p>
      </div>
    </main>
  );
}
