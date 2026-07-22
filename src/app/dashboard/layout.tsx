import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { DashboardSidebar } from '@features/dashboard/components/sidebar';
import { ToastProvider } from '@features/dashboard/components/toast';
import PostHogIdentify from '@features/shared/components/posthog-identify';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AuthUserMeta = {
  avatar_url?: string;
  user_name?: string;
  preferred_username?: string;
};

/**
 * Authenticated dashboard shell. Redirects unauthenticated visitors to
 * /login. Navigation lives entirely in the persistent left sidebar, so
 * there is no top nav bar inside the dashboard. The content keeps a
 * fixed left margin matching the collapsed rail; the sidebar floats over
 * the content when it expands on hover, so the layout never shifts.
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

  const meta = (authData.user.user_metadata ?? {}) as AuthUserMeta;
  const handle =
    meta.user_name ?? meta.preferred_username ?? authData.user.email ?? 'You';

  // Internal user row (id/plan/created_at) for PostHog identify. Best-effort:
  // a missing row must never block the dashboard from rendering.
  const { data: appUser } = (await supabase
    .from('users')
    .select('id, email, plan, created_at')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()) as unknown as {
    data: { id: string; email: string | null; plan: string | null; created_at: string | null } | null;
  };

  return (
    <ToastProvider>
      {appUser && (
        <PostHogIdentify
          distinctId={appUser.id}
          email={appUser.email}
          plan={appUser.plan}
          createdAt={appUser.created_at}
        />
      )}
      <div className="senix-app relative min-h-screen bg-base text-primary">
        <div className="pointer-events-none fixed inset-0 bg-hero-dots opacity-30" aria-hidden />
        <DashboardSidebar handle={handle} avatarUrl={meta.avatar_url} />

        <div className="relative px-4 pb-10 pt-20 md:ml-16 md:p-8 md:pb-12">
          <main className="animate-fade-in mx-auto min-w-0 max-w-6xl">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
