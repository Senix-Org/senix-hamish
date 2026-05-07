import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { Reveal, RevealItem, RevealStagger } from '@/components/reveal';

type Release = {
  date: string;
  version: string;
  title: string;
  bullets: string[];
};

const RELEASES: Release[] = [
  {
    date: 'May 2026',
    version: 'v0.6.0',
    title: 'Public beta',
    bullets: [
      'Customer dashboard with installation list and per-repo enable / disable.',
      'GitHub PR comments — reviews post within ~30 seconds; re-pushes update the same comment.',
      'DeepSeek as default analysis provider for reliable structured output.',
      'Eight-flag risk taxonomy: sql-injection, auth-change, removed-validation, hardcoded-secret, payment-logic-change, new-external-api, dependency-added, data-leak.',
      'Soft-delete for installations — uninstalling preserves history for re-install.',
    ],
  },
  {
    date: 'April 2026',
    version: 'v0.4.0',
    title: 'Private alpha',
    bullets: [
      'Initial pipeline: webhook → queue → worker → LLM → Supabase.',
      'Tree-sitter structural diff for JavaScript, TypeScript, and Python.',
      'Eval framework with 10 hand-crafted cases and 4-dimension scoring rubric.',
      '10 design partners onboarded.',
    ],
  },
];

/**
 * Public changelog timeline. Each entry fades up as it scrolls into view.
 * New releases get prepended to `RELEASES` — keep them dated and tied to
 * a version label so deep links remain stable.
 */
export default function ChangelogPage(): React.ReactElement {
  return (
    <>
      <SiteNav />
      <main className="border-b border-zinc-800/40">
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 bg-grid opacity-50" />
          <div className="relative max-w-3xl mx-auto px-5 sm:px-6 pt-20 sm:pt-28 pb-12 text-center">
            <Reveal>
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
                Changelog
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-[-0.02em]">
                Everything new in Senix
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Releases, fixes, and what we&apos;re working on next.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-5 sm:px-6 py-16">
          <RevealStagger className="relative">
            <div
              aria-hidden
              className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-zinc-800 via-zinc-800/60 to-transparent"
            />
            <ul className="space-y-12">
              {RELEASES.map((r) => (
                <RevealItem key={r.version} className="relative pl-10">
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 size-4 rounded-full border border-green-500/40 bg-zinc-950 grid place-items-center"
                  >
                    <span className="size-1.5 rounded-full bg-green-500" />
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-zinc-500">{r.date}</span>
                    <span className="font-mono text-green-500">{r.version}</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
                    {r.title}
                  </h2>
                  <ul className="mt-4 space-y-2 text-[15px] text-zinc-300 leading-relaxed">
                    {r.bullets.map((b) => (
                      <li key={b} className="flex gap-2.5">
                        <span aria-hidden className="text-zinc-600">
                          —
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </RevealItem>
              ))}
            </ul>
          </RevealStagger>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
