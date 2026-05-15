import Image from 'next/image';
import Link from 'next/link';
import SignOutButton from './sign-out-button';
import { FeedbackTrigger } from './feedback-modal';

type AppNavProps = {
  handle: string;
  avatarUrl?: string;
};

/**
 * Top navigation for authenticated dashboard routes. Intentionally
 * strips the marketing nav (Product, Pricing, Docs, …) so signed-in
 * users see a focused workspace. The Feedback button opens an in-app
 * modal — no mailto handoff.
 */
export function AppNav({ handle, avatarUrl }: AppNavProps): React.ReactElement {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/50 bg-zinc-950/70 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
          <img
            src="/logo.png"
            alt=""
            className="h-7 w-7 rounded-md ring-1 ring-zinc-800 group-hover:ring-green-500/40 transition"
          />
          <span className="font-mono text-sm tracking-tight text-zinc-100">senix</span>
        </Link>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 cursor-default select-none">
            {avatarUrl && (
              <Image
                src={avatarUrl}
                alt={handle}
                width={24}
                height={24}
                className="rounded-full border border-zinc-800"
                unoptimized
              />
            )}
            <span className="text-sm text-zinc-200 hidden sm:inline">{handle}</span>
          </div>
          <div className="border-l border-zinc-800 h-6 mx-3" />
          <FeedbackTrigger />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
