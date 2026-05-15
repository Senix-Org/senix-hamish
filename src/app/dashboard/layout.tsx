import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { AppNav } from '@/components/app-nav';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SidebarInstallation = {
  id: string;
  account_login: string;
  repoCount: number;
};

type AuthUserMeta = {
  avatar_url?: string;
  user_name?: string;
  preferred_username?: string;
};

/**
 * Authenticated dashboard shell. Redirects unauthenticated visitors to
 * /login. Uses the focused AppNav (no marketing links) rather than the
 * public SiteNav.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect('/login');
  }

  const installs = await loadInstallations(authData.user.id);
  const meta = (authData.user.user_metadata ?? {}) as AuthUserMeta;
  const handle = meta.user_name ?? meta.preferred_username ?? authData.user.email ?? 'You';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppNav handle={handle} avatarUrl={meta.avatar_url} />

      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-10">
        {installs.length > 0 && (
          <aside className="hidden md:block">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500 mb-3">
              Installations
            </div>
            <ul className="space-y-1.5">
              {installs.map((i) => (
                <li key={i.id} className="text-sm text-zinc-300">
                  <span className="font-medium">{i.account_login}</span>
                  <span className="text-zinc-500"> · {i.repoCount} repos</span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

async function loadInstallations(authUserId: string): Promise<SidebarInstallation[]> {
  const { data: userRow } = (await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()) as unknown as { data: { id: string } | null };

  if (!userRow) return [];

  const { data: rows } = (await supabaseAdmin
    .from('installations')
    .select('id, account_login, repositories(count)')
    .eq('installed_by_user_id', userRow.id)
    .is('uninstalled_at', null)
    .order('account_login', { ascending: true })) as unknown as {
    data: Array<{ id: string; account_login: string; repositories: Array<{ count: number }> }> | null;
  };

  return (rows ?? []).map((r) => ({
    id: r.id,
    account_login: r.account_login,
    repoCount: r.repositories?.[0]?.count ?? 0,
  }));
}
