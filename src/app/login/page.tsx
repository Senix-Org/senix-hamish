import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import AutoSignIn from '@/components/auto-sign-in';
import { SiteNav } from '@/components/site-nav';

export const dynamic = 'force-dynamic';

type SearchParams = { next?: string; installation_id?: string };

/**
 * Sign-in route. Already-authenticated visitors skip straight to `next`
 * (default `/dashboard`); everyone else is bounced into GitHub OAuth on
 * mount via `<AutoSignIn>`. There is no manual button — clicking "Sign
 * in" anywhere in the app should land on the dashboard with one
 * external authorize step.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const next = buildNextPath(params);

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect(next);
  }

  return (
    <>
      <SiteNav />
      <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden flex items-center justify-center px-5 sm:px-6 py-16">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-50" />
        <div
          aria-hidden
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-glow-green pointer-events-none"
        />
        <div className="relative max-w-sm w-full">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-8 shadow-2xl shadow-green-950/20">
            <AutoSignIn next={next} />
          </div>
        </div>
      </main>
    </>
  );
}

function buildNextPath(params: SearchParams): string {
  const base = params.next ?? '/dashboard';
  if (params.installation_id) {
    const url = new URL(base, 'http://placeholder');
    url.searchParams.set('installation_id', params.installation_id);
    return `${url.pathname}${url.search}`;
  }
  return base;
}
