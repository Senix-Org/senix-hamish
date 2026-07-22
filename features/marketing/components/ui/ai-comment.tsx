'use client';

import { useEffect, useRef } from 'react';
import type { AICommentData } from './diff-types';
import { riskBadgeClass, riskLabel } from './diff-types';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

type AICommentProps = {
  comment: AICommentData;
  animate?: boolean;
  className?: string;
};

/**
 * Inline Senix review bubble anchored beside a diff line.
 */
export function AIComment({
  comment,
  animate = true,
  className = '',
}: AICommentProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!animate || reduced || !ref.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      if (!ref.current) return;

      ctx = gsap.context(() => {
        gsap.fromTo(
          ref.current,
          { opacity: 0, x: 12, scale: 0.96 },
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.55,
            ease: 'power3.out',
            delay: 1.4,
            onComplete: () => {
              gsap.to(ref.current, {
                boxShadow: '0 0 24px -4px rgba(34, 197, 94, 0.45)',
                duration: 0.8,
                yoyo: true,
                repeat: 1,
              });
            },
          },
        );
      });
    })();

    return () => ctx?.revert();
  }, [animate, reduced]);

  return (
    <div
      ref={ref}
      className={[
        'ai-comment relative ml-4 rounded-[10px] border border-green-500/25 bg-[#0f0d14]/95 p-3 shadow-lg shadow-black/30',
        animate && !reduced ? 'opacity-0' : '',
        className,
      ].join(' ')}
      role="note"
      aria-label={`Senix review: ${comment.title}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="size-5 rounded-full bg-zinc-800 grid place-items-center text-[10px] font-mono text-green-400">
          s
        </span>
        <span className="text-xs font-medium text-zinc-200">senix-bot</span>
        <span
          className={`ml-auto text-[10px] font-semibold uppercase tracking-wide rounded-md border px-1.5 py-0.5 ${riskBadgeClass(comment.risk)}`}
        >
          {riskLabel(comment.risk)}
        </span>
      </div>
      <p className="text-xs font-semibold text-zinc-100">{comment.title}</p>
      <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{comment.body}</p>
      {comment.tags && comment.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {comment.tags.map((tag) => (
            <code
              key={tag}
              className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
            >
              {tag}
            </code>
          ))}
        </div>
      ) : null}
    </div>
  );
}
