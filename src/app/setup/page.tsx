import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { SiteNav } from '@/components/site-nav';

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
    <>
      <SiteNav />
      <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden flex items-center justify-center px-5 sm:px-6 py-16">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-50" />
        <div
          aria-hidden
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-glow-green pointer-events-none"
        />
        <div className="relative max-w-md w-full rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-8 shadow-2xl shadow-green-950/20">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-green-400 bg-green-950/40 border border-green-900/50 rounded-full px-2.5 py-1 mb-5">
            <CheckCircle2 size={12} />
            Connected
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.01em] leading-snug">
            Senix is connected to{' '}
            <span className="text-green-400 font-mono">{installation.account_login}</span>.
          </h1>
          <p className="mt-3 text-zinc-400 leading-relaxed">
            You&apos;ll see analyses on every PR opened in {repoCount}{' '}
            {repoCount === 1 ? 'repo' : 'repos'}.
          </p>
          <Link
            href="/dashboard"
            className="group mt-7 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-green-500 hover:bg-green-400 text-zinc-950 font-medium text-sm transition"
          >
            View dashboard
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-3">
              What happens now
            </div>
            <ul className="space-y-2 text-sm text-zinc-300 leading-relaxed">
              <li className="flex gap-2.5">
                <span aria-hidden className="text-zinc-600">—</span>
                Open a pull request in any connected repo
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="text-zinc-600">—</span>
                Senix analyzes the structural diff with our prompt
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="text-zinc-600">—</span>
                A 3-sentence review appears as a comment within 30 seconds
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="text-zinc-600">—</span>
                You can disable specific repos any time from the dashboard
              </li>
            </ul>
          </div>
        </div>
      </main>
    </>
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
    <>
      <SiteNav />
      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-5 sm:px-6 py-16">
        <div className="max-w-md w-full rounded-xl border border-red-900/40 bg-red-950/20 p-8">
          <div className="text-red-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
            Setup error
          </div>
          <p className="text-zinc-200 leading-relaxed">{message}</p>
        </div>
      </main>
    </>
  );
}
