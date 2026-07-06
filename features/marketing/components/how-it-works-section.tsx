'use client';

import { useEffect, useRef } from 'react';
import { GitBranch, GitPullRequest, MessageSquareCode } from 'lucide-react';
import { SectionHeading } from './ui/section-heading';
import { MarketingCard } from './ui/card';
import { useGsapScrollReveal } from '../hooks/use-gsap-scroll-reveal';
import { useReducedMotion } from '../hooks/use-reduced-motion';

const STEPS = [
  {
    n: '01',
    title: 'PR opened',
    body: 'Senix watches connected repos. New and updated PRs trigger analysis automatically.',
    Icon: GitPullRequest,
  },
  {
    n: '02',
    title: 'Senix analyzes',
    body: 'We parse the structural diff, classify risks, and draft a behavioral summary.',
    Icon: GitBranch,
  },
  {
    n: '03',
    title: 'Risk summary posted',
    body: 'A single PR comment lands within 30 seconds with severity, tags, and focus files.',
    Icon: MessageSquareCode,
  },
];

/**
 * Three-step horizontal flow with SVG connector that draws on scroll.
 */
export function HowItWorksSection(): React.ReactElement {
  const sectionRef = useGsapScrollReveal<HTMLElement>({
    childSelector: '[data-step-card]',
    stagger: 0.12,
  });
  const lineRef = useRef<SVGLineElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !lineRef.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const line = lineRef.current;
      if (!line) return;
      const length = line.getTotalLength();
      line.style.strokeDasharray = `${length}`;
      line.style.strokeDashoffset = `${length}`;

      ctx = gsap.context(() => {
        gsap.to(line, {
          strokeDashoffset: 0,
          duration: 1.2,
          ease: 'power2.inOut',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            once: true,
          },
        });
      });
    })();

    return () => ctx?.revert();
  }, [reduced, sectionRef]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative border-y border-zinc-800/40 bg-zinc-950"
    >
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps. Thirty seconds."
          description="No agents to configure. No rules to write. Senix reads the structural diff of every PR you open and explains what changed in plain English."
        />

        <div className="relative mt-16 hidden md:block" aria-hidden>
          <svg
            className="absolute left-[10%] right-[10%] top-12 h-1 w-[80%]"
            viewBox="0 0 100 2"
            preserveAspectRatio="none"
          >
            <line
              ref={lineRef}
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="rgba(34, 197, 94, 0.35)"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map(({ n, title, body, Icon }) => (
            <MarketingCard
              key={n}
              as="article"
              data-step-card
              className="group relative opacity-0"
            >
              <div
                aria-hidden
                className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-600">{n}</span>
                <Icon size={18} className="text-green-500" strokeWidth={1.5} />
              </div>
              <h3 className="mt-8 text-lg font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
            </MarketingCard>
          ))}
        </div>
      </div>
    </section>
  );
}
