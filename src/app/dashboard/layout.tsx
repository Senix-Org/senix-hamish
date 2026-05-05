import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import SignOutButton from '@/components/sign-out-button';

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
 * /login. Loads the signed-in user's installations and per-install repo
 * counts (via supabaseAdmin — RLS isn't strictly required here since
 * we've already checked the auth user, and we want a single sidebar
 * query path).
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
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold tracking-tight">
            Senix
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{handle}</span>
            {meta.avatar_url && (
              <Image
                src={meta.avatar_url}
                alt={handle}
                width={28}
                height={28}
                className="rounded-full border border-zinc-800"
                unoptimized
              />
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
        {installs.length > 0 && (
          <aside className="hidden md:block">
            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
              Installations
            </div>
            <ul className="space-y-1">
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
    .order('account_login', { ascending: true })) as unknown as {
    data: Array<{ id: string; account_login: string; repositories: Array<{ count: number }> }> | null;
  };

  return (rows ?? []).map((r) => ({
    id: r.id,
    account_login: r.account_login,
    repoCount: r.repositories?.[0]?.count ?? 0,
  }));
}
