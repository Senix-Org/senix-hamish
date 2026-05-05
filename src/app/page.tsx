import Link from 'next/link';
import SignInButton from '@/components/sign-in-button';

export default function HomePage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="inline-block px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs font-medium mb-8">
          Building in public — Day 9
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Make AI-generated code reviews <span className="text-blue-400">actually reviewable</span>.
        </h1>

        <p className="text-xl text-zinc-400 mb-10 leading-relaxed">
          AI agents are writing more of your codebase every week. Reviewing 2,000-line PRs is impossible.
          We translate them into 3-sentence behavioral summaries so humans can catch real bugs in seconds.
        </p>

        <form
          action="https://formspree.io/f/mrernddv"
          method="POST"
          className="flex flex-col sm:flex-row gap-3 mb-4"
        >
          <input
            name="email"
            type="email"
            required
            placeholder="you@yourcompany.com"
            className="flex-1 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-medium transition"
          >
            Get early access
          </button>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-10">
          <SignInButton />
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">
            Already installed? Go to dashboard →
          </Link>
        </div>

        <div className="flex gap-6 text-sm text-zinc-500">
          <a href="https://github.com/senix-org" className="hover:text-zinc-300">GitHub</a>
          <a href="https://twitter.com/@alvintafah" className="hover:text-zinc-300">Twitter</a>
          <span>—</span>
          <span>Built in Cameroon, shipping in 30 days.</span>
        </div>
      </div>
    </main>
  );
}
