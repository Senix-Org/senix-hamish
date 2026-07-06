'use client';

import { DiffPanel } from './ui/diff-panel';
import { SectionHeading } from './ui/section-heading';
import { SAMPLE_AI_COMMENT, SAMPLE_DIFF_LINES } from './ui/diff-types';
import { useGsapScrollReveal } from '../hooks/use-gsap-scroll-reveal';

/**
 * Product showcase with live-style diff panel and AI comment bubble.
 */
export function ProductSection(): React.ReactElement {
  const ref = useGsapScrollReveal<HTMLElement>({ y: 32 });

  return (
    <section id="product" ref={ref} className="relative mx-auto max-w-6xl px-5 py-24 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-glow-green opacity-60"
      />

      <SectionHeading
        align="center"
        eyebrow="What you get"
        title="One diff. Instant risk context."
        description="Senix posts inline review context where reviewers already work — on the pull request, anchored to the lines that matter."
        className="relative mx-auto mb-12"
      />

      <DiffPanel
        lines={SAMPLE_DIFF_LINES}
        comment={SAMPLE_AI_COMMENT}
        className="relative mx-auto max-w-3xl"
      />
    </section>
  );
}
