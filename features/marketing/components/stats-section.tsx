'use client';

import { AnimatedCounter } from './animated-counter';
import { useGsapScrollReveal } from '../hooks/use-gsap-scroll-reveal';

const STATS = [
  { value: 30, suffix: 's', label: 'average analysis time', isTime: true },
  { value: 4, suffix: '', label: 'AI providers, always reviewing' },
  { value: 0.01, prefix: '$', label: 'average cost per review', decimals: 2 },
];

/**
 * Stats band with animated counters.
 */
export function StatsSection(): React.ReactElement {
  const ref = useGsapScrollReveal<HTMLElement>({
    childSelector: '[data-stat]',
    stagger: 0.12,
  });

  return (
    <section
      ref={ref}
      className="border-y border-zinc-800/40 bg-zinc-900/30"
    >
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              data-stat
              className="border-l-0 text-center opacity-0 first:border-l-0 first:pl-0 sm:border-l sm:border-zinc-800 sm:pl-8 sm:text-left"
            >
              <div className="text-5xl font-bold tracking-tight text-green-500 sm:text-6xl">
                {stat.isTime ? (
                  <>
                    <AnimatedCounter value={stat.value} duration={1.2} />
                    {stat.suffix}
                  </>
                ) : (
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    prefix={stat.prefix}
                    decimals={stat.decimals ?? 0}
                    duration={1.4}
                  />
                )}
              </div>
              <div className="mt-3 text-sm text-zinc-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
