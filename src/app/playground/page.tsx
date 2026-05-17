import type { Metadata } from 'next';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { Reveal } from '@/components/reveal';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { Playground } from '@/components/playground/playground';

export const metadata: Metadata = {
  title: 'Playground — Senix',
  description: 'Paste a git diff and get a Senix shipping brief. No signup required.',
};

export const dynamic = 'force-dynamic';

/**
 * Public playground. Anyone can paste a diff and get a shipping brief
 * without an account. Login state only changes where the upsell banner
 * points, so it is read here and handed to the client component.
 */
export default async function PlaygroundPage(): Promise<React.ReactElement> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(data.user);

  return (
    <>
      <SiteNav />
      <main className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-20">
        <Reveal>
          <div className="max-w-2xl">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
              Playground
            </span>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-[-0.02em]">
              Try Senix on a real diff
            </h1>
            <p className="mt-3 text-zinc-400 leading-relaxed">
              Paste a git diff. Get a shipping brief. No signup.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-10">
            <Playground isLoggedIn={isLoggedIn} />
          </div>
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
