'use client';

import { GitPullRequest, Plug, Timer } from 'lucide-react';
import { useGsapScrollReveal } from '../hooks/use-gsap-scroll-reveal';

const PROOF_ITEMS = [
  { label: 'GitHub App', Icon: GitPullRequest },
  { label: 'MCP for IDEs', Icon: Plug },
  { label: 'Under 30s', Icon: Timer },
];

/**
 * Compact credibility strip below the hero (no duplicate stats).
 */
export function SocialProofStrip(): React.ReactElement {
  const ref = useGsapScrollReveal<HTMLDivElement>({ y: 12, stagger: 0.08, childSelector: '[data-proof-item]' });

  return (
    <section
      ref={ref}
      aria-label="Product capabilities"
      className="border-b border-white/[0.06] bg-[#0A0A0B]/80 py-5"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 sm:px-6">
        {PROOF_ITEMS.map(({ label, Icon }) => (
          <div
            key={label}
            data-proof-item
            className="flex items-center gap-2 text-sm text-zinc-500 opacity-0"
          >
            <Icon size={15} className="text-green-500/80" strokeWidth={1.75} aria-hidden />
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}
