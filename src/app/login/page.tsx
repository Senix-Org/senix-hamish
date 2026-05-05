import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import SignInButton from '@/components/sign-in-button';

export const dynamic = 'force-dynamic';

type SearchParams = { next?: string; installation_id?: string };

/**
 * Sign-in page. If the visitor already has a valid session we send them
 * straight to `next` (default `/dashboard`). The `installation_id` query
 * param is preserved through the round-trip so that landing on /setup
 * mid-OAuth still surfaces the right install id.
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold mb-3">Sign in to Senix</h1>
        <p className="text-zinc-400 mb-8">
          We use your GitHub account to link your installs and analyses.
        </p>
        <div className="flex justify-center">
          <SignInButton next={next} />
        </div>
      </div>
    </main>
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
