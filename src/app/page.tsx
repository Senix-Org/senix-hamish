import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  GitBranch,
  GitPullRequest,
  MessageSquareCode,
} from 'lucide-react';
import { SiteNav } from '@features/shared/components/site-nav';
import { SiteFooter } from '@features/shared/components/site-footer';
import { Reveal, RevealItem, RevealStagger } from '@features/shared/components/reveal';
import SignInButton from '@features/shared/components/sign-in-button';

type HomeSearchParams = { code?: string; next?: string };

const RISK_FLAGS = [
  'sql-injection',
  'auth-change',
  'removed-validation',
  'hardcoded-secret',
  'payment-logic-change',
  'new-external-api',
  'dependency-added',
  'data-leak',
];

const HOW_STEPS = [
  {
    n: '01',
    title: 'Install on GitHub',
    body: 'One click from the App store. Pick the repos you want analyzed — public, private, monorepo, anything.',
    Icon: GitBranch,
  },
  {
    n: '02',
    title: 'Open a pull request',
    body: 'We watch for new and updated PRs in real time. Re-pushes update the same comment instead of spamming new ones.',
    Icon: GitPullRequest,
  },
  {
    n: '03',
    title: 'Read the review',
    body: 'A 3-sentence behavioral summary, a risk level, and the exact files reviewers should focus on. Within 30 seconds.',
    Icon: MessageSquareCode,
  },
];

const STATS = [
  { value: '30s', label: 'average analysis time' },
  { value: '4', label: 'AI providers, always reviewing' },
  { value: '$0.01', label: 'average cost per review' },
];

const FOCUS_ROWS = [
  {
    file: 'sample.js',
    lines: '12-18',
    reason: 'Foo class became a stateful counter — confirm callers expect the new return shape.',
  },
  {
    file: 'sample.js',
    lines: '24-31',
    reason: 'fetchUser hardcodes an API token; rotate it and read from env before merging.',
  },
  {
    file: 'sample.js',
    lines: '3-7',
    reason: 'hello() now throws TypeError on non-string input — verify upstream callers handle it.',
  },
];

/**
 * Public marketing landing page. Composed of hero, product showcase,
 * how-it-works, taxonomy, stats, and CTA sections, each fading up as the
 * viewport reaches them.
 *
 * Defensive forward: if Supabase's redirect URL allowlist sends an OAuth
 * `code` to `/` instead of `/auth/callback`, we hand it off to the
 * callback handler so the user still lands on `/dashboard` instead of
 * staring at the marketing page mid-auth.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  if (params.code) {
    const next = params.next ?? '/dashboard';
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}&next=${encodeURIComponent(next)}`);
  }

  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Showcase />
        <HowItWorks />
        <BuiltForAI />
        <Stats />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero(): React.ReactElement {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800/40">
      <div aria-hidden className="absolute inset-0 bg-hero-dots pointer-events-none" />
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-glow-green pointer-events-none"
      />
      <div className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-28 sm:pt-36 pb-24 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            v1.0
          </span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mt-7 text-4xl sm:text-6xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05]">
            AI code review
            <br />
            <span className="text-zinc-400">for your pull requests.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-7 text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            Senix reads every PR your team opens and posts a behavioral summary with risk level as
            a comment within 30 seconds. Built for teams shipping with Cursor, Copilot, and Claude
            Code.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <SignInButton label="Get started free" variant="hero" />
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center px-5 py-3 rounded-md border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 text-zinc-200 font-medium text-sm transition"
            >
              See how it works
            </Link>
            <Link
              href="/playground"
              className="group inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-md text-sm font-medium text-zinc-400 hover:text-green-400 transition"
            >
              Try the playground
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.28}>
          <p className="mt-16 text-sm text-zinc-500">
            Trusted by developers shipping with AI
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Showcase(): React.ReactElement {
  return (
    <section className="relative max-w-5xl mx-auto px-5 sm:px-6 py-24">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] bg-glow-green opacity-70 pointer-events-none"
      />
      <Reveal>
        <div className="text-center mb-10">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
            What you get
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
            One comment. Everything they need.
          </h2>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <SampleComment />
      </Reveal>
    </section>
  );
}

function SampleComment(): React.ReactElement {
  return (
    <article className="relative rounded-xl border border-zinc-300 bg-white text-zinc-900 p-6 sm:p-8 shadow-2xl shadow-black/40 ring-1 ring-black/5">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-zinc-200">
        <div className="flex items-center gap-2 text-sm">
          <span className="size-7 rounded-full bg-zinc-900 grid place-items-center text-white text-xs font-mono">
            s
          </span>
          <span className="font-mono text-zinc-700">senix-bot</span>
          <span className="text-zinc-400">commented on PR #42</span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide rounded px-2 py-0.5 bg-red-100 text-red-700">
          risk: high
        </span>
      </div>

      <h3 className="mt-5 text-base font-semibold">Behavioral summary</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">
        The hello function now validates input type and throws TypeError on non-string, while its
        output format changed to a trimmed &apos;Hello, ...!&apos; string. The Foo class was
        transformed into a stateful counter where bar() increments and returns a count, and a new
        reset() method was added. A new fetchUser function performs an outbound authenticated HTTP
        request with a hardcoded secret, introducing both external API dependency and credential
        exposure.
      </p>

      <h3 className="mt-6 text-base font-semibold">Detected risks</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {['auth-change', 'new-external-api', 'hardcoded-secret'].map((tag) => (
          <code
            key={tag}
            className="bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded font-mono text-xs"
          >
            {tag}
          </code>
        ))}
      </div>

      <h3 className="mt-6 text-base font-semibold">Reviewer should focus on</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm border border-zinc-200 rounded">
          <thead className="bg-zinc-50 text-zinc-600 text-left">
            <tr>
              <th className="px-3 py-2 font-medium border-b border-zinc-200">File</th>
              <th className="px-3 py-2 font-medium border-b border-zinc-200">Lines</th>
              <th className="px-3 py-2 font-medium border-b border-zinc-200">Why</th>
            </tr>
          </thead>
          <tbody>
            {FOCUS_ROWS.map((row, i) => (
              <tr key={i} className="border-b border-zinc-200 last:border-b-0">
                <td className="px-3 py-2 font-mono text-xs">{row.file}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.lines}</td>
                <td className="px-3 py-2 text-zinc-700">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 pt-4 border-t border-zinc-200 text-xs text-zinc-500 italic">
        Analyzed by Senix · deepseek · 1,287 tokens · View on dashboard
      </p>
    </article>
  );
}

function HowItWorks(): React.ReactElement {
  return (
    <section
      id="how-it-works"
      className="relative border-y border-zinc-800/40 bg-zinc-950"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-24">
        <Reveal>
          <div className="max-w-2xl">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
              How it works
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Three steps. Thirty seconds.
            </h2>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              No agents to configure. No rules to write. Senix reads the structural diff of every
              PR you open and explains what changed in plain English.
            </p>
          </div>
        </Reveal>

        <RevealStagger className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {HOW_STEPS.map(({ n, title, body, Icon }) => (
            <RevealItem
              key={n}
              className="group relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 transition-colors hover:border-green-500/30 hover:bg-zinc-900/60 hover:shadow-[0_0_0_1px_rgba(62,207,142,0.15)]"
            >
              <div
                aria-hidden
                className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-600">{n}</span>
                <Icon size={18} className="text-green-500" strokeWidth={1.5} />
              </div>
              <h3 className="mt-8 text-lg font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{body}</p>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

function BuiltForAI(): React.ReactElement {
  return (
    <section id="product" className="max-w-6xl mx-auto px-5 sm:px-6 py-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        <Reveal>
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
              Product
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Built for the way developers ship in 2026.
            </h2>
            <p className="mt-5 text-zinc-400 leading-relaxed">
              Cursor, Copilot, and Claude Code ship code faster than humans can read it. They also
              quietly introduce patterns reviewers miss — hardcoded secrets, removed validation,
              payment logic edits.
            </p>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              Senix surfaces those patterns as tagged risks reviewers can scan in 10 seconds.
              Every flag points at a specific file and line. No essays, no fluff.
            </p>
          </div>
        </Reveal>

        <RevealStagger
          staggerMs={40}
          className="grid grid-cols-2 gap-2.5"
        >
          {RISK_FLAGS.map((flag) => (
            <RevealItem
              key={flag}
              className="font-mono text-xs sm:text-sm bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-2 rounded-md hover:border-green-500/40 hover:text-zinc-100 transition-colors text-center"
            >
              {flag}
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

function Stats(): React.ReactElement {
  return (
    <section className="border-y border-zinc-800/40 bg-zinc-900/30">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-24">
        <RevealStagger className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STATS.map(({ value, label }) => (
            <RevealItem
              key={label}
              className="text-center sm:text-left border-l-0 sm:border-l border-zinc-800 sm:pl-8 first:border-l-0 first:pl-0"
            >
              <div className="text-5xl sm:text-6xl font-bold tracking-tight text-green-500 tabular-nums">
                {value}
              </div>
              <div className="mt-3 text-sm text-zinc-400">{label}</div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

function FinalCta(): React.ReactElement {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
      <div
        aria-hidden
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-glow-green opacity-90 pointer-events-none"
      />
      <div className="relative max-w-3xl mx-auto px-5 sm:px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            Stop reading every line.
            <br />
            <span className="text-green-500">Read every risk.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-6 text-zinc-400 leading-relaxed">
            Two minutes from install to your first review.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <SignInButton label="Get started free" variant="hero" className="mt-9 px-6" />
        </Reveal>
      </div>
    </section>
  );
}
