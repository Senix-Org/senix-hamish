import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { DashboardSidebar } from '@features/dashboard/components/sidebar';
import { ToastProvider } from '@features/dashboard/components/toast';

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

  return (
    <ToastProvider>
      <div className="senix-app min-h-screen bg-base text-primary">
        <DashboardSidebar handle={handle} avatarUrl={meta.avatar_url} />

        <div className="px-4 pb-8 pt-20 md:ml-16 md:p-8">
          <main className="animate-fade-in mx-auto min-w-0 max-w-5xl">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
