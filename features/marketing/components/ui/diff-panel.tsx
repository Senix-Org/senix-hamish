'use client';

import { useEffect, useRef } from 'react';
import { AIComment } from './ai-comment';
import type { AICommentData, DiffLine } from './diff-types';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

type DiffPanelProps = {
  filename?: string;
  lines: DiffLine[];
  comment?: AICommentData;
  className?: string;
  animate?: boolean;
};

function lineClass(type: DiffLine['type']): string {
  switch (type) {
    case 'add':
      return 'bg-green-500/10 text-green-400/95 border-l-2 border-green-500/50';
    case 'remove':
      return 'bg-red-500/8 text-red-400/90 border-l-2 border-red-500/40';
    case 'hunk':
      return 'text-sky-400/80 bg-sky-500/5';
    default:
      return 'text-zinc-500';
  }
}

/**
 * GitHub-style diff panel with sequential line reveal and optional AI comment.
 */
export function DiffPanel({
  filename = 'src/services/user.ts',
  lines,
  comment,
  className = '',
  animate = true,
}: DiffPanelProps): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!animate || reduced || !panelRef.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const rowEls = panelRef.current?.querySelectorAll('[data-diff-line]');
      if (!rowEls?.length) return;

      ctx = gsap.context(() => {
        gsap.fromTo(
          rowEls,
          { opacity: 0, x: -8 },
          {
            opacity: 1,
            x: 0,
            duration: 0.35,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: panelRef.current,
              start: 'top 80%',
              once: true,
            },
          },
        );
      }, panelRef);
    })();

    return () => ctx?.revert();
  }, [animate, reduced]);

  return (
    <div
      ref={panelRef}
      className={[
        'diff-panel overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#0B0D0C] shadow-2xl shadow-black/50',
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.08] bg-zinc-900/60 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-500/70" />
        <span className="size-2.5 rounded-full bg-amber-500/70" />
        <span className="size-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 font-mono text-xs text-zinc-400">{filename}</span>
      </div>

      <div className="relative font-mono text-[11px] sm:text-xs leading-6">
        {lines.map((line, index) => (
          <div key={index} className="relative flex">
            <span className="w-10 shrink-0 select-none text-right pr-3 text-zinc-600 tabular-nums">
              {line.lineNumber ?? ''}
            </span>
            <pre
              data-diff-line={animate && !reduced ? '' : undefined}
              className={[
                'flex-1 overflow-x-auto px-3 py-0.5 whitespace-pre',
                lineClass(line.type),
                animate && !reduced ? 'opacity-0' : '',
              ].join(' ')}
            >
              {line.content}
            </pre>
            {comment && comment.lineIndex === index ? (
              <div className="absolute left-[calc(100%-1rem)] top-0 z-10 hidden lg:block w-64 -translate-y-1">
                <AIComment comment={comment} animate={animate} />
              </div>
            ) : null}
          </div>
        ))}

        {comment ? (
          <div className="lg:hidden border-t border-white/[0.06] p-4">
            <AIComment comment={comment} animate={animate} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
