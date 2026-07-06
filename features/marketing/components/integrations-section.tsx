'use client';

import { SectionHeading } from './ui/section-heading';
import { useGsapScrollReveal } from '../hooks/use-gsap-scroll-reveal';

type Integration = {
  name: string;
  abbr: string;
  description: string;
};

const INTEGRATIONS: Integration[] = [
  { name: 'Cursor', abbr: 'Cu', description: 'MCP-native reviews in your editor' },
  { name: 'GitHub Copilot', abbr: 'Co', description: 'Catch risky AI-generated diffs on PRs' },
  { name: 'Claude Code', abbr: 'Cl', description: 'Structural diff context for agent output' },
];

/**
 * Integration logos row with green hover glow.
 */
export function IntegrationsSection(): React.ReactElement {
  const ref = useGsapScrollReveal<HTMLElement>({
    childSelector: '[data-integration]',
    stagger: 0.1,
  });

  return (
    <section ref={ref} className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
      <SectionHeading
        align="center"
        eyebrow="Integrations"
        title="Works where you already ship."
        description="Connect GitHub once. Review in the PR, in Cursor, or via MCP from any IDE."
        className="mx-auto"
      />

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {INTEGRATIONS.map(({ name, abbr, description }) => (
          <div
            key={name}
            data-integration
            className="integration-tile group flex flex-col items-center rounded-[10px] border border-white/[0.08] bg-zinc-900/30 px-6 py-8 text-center opacity-0 transition-all duration-300 hover:-translate-y-1 hover:border-green-500/35 hover:shadow-[0_0_32px_-8px_rgba(34,197,94,0.4)]"
          >
            <div className="mb-4 grid size-14 place-items-center rounded-[10px] border border-white/[0.08] bg-zinc-950 font-mono text-lg font-semibold text-zinc-200 transition group-hover:border-green-500/40 group-hover:text-green-400">
              {abbr}
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">{name}</h3>
            <p className="mt-2 text-xs text-zinc-500">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
