'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/use-reduced-motion';

const DIFF_LINES = [
  { type: 'ctx' as const, n: 24, text: '  async fetchUser(id: string) {' },
  { type: 'del' as const, n: 25, text: '-    return fetch(`/api/users/${id}`);' },
  { type: 'add' as const, n: 25, text: '+    const token = process.env.API_TOKEN;' },
  { type: 'add' as const, n: 26, text: '+    return fetch(`/api/users/${id}`, { headers: { Authorization: token } });' },
  { type: 'ctx' as const, n: 27, text: '  }' },
];

function lineTone(type: (typeof DIFF_LINES)[0]['type']): string {
  if (type === 'add') return 'text-green-400/90 bg-green-500/[0.08]';
  if (type === 'del') return 'text-red-400/75 bg-red-500/[0.06] line-through decoration-red-400/30';
  return 'text-zinc-500';
}

/**
 * Floating PR review mockup for the hero. Scan beam, diff reveal, and subtle tilt.
 */
export function HeroProductPreview(): React.ReactElement {
  const frameRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !frameRef.current) return;

    let ctx: { revert: () => void } | undefined;
    let removeMove: (() => void) | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const frame = frameRef.current;
      if (!frame) return;

      ctx = gsap.context(() => {
        gsap.fromTo(
          frame,
          { opacity: 0, y: 40, rotateX: 8, scale: 0.94 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 1.1,
            ease: 'power3.out',
            delay: 0.35,
          },
        );

        const lines = frame.querySelectorAll('[data-preview-line]');
        gsap.fromTo(
          lines,
          { opacity: 0, x: -6 },
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.07,
            ease: 'power2.out',
            delay: 0.75,
          },
        );

        const comment = frame.querySelector('[data-preview-comment]');
        if (comment) {
          gsap.fromTo(
            comment,
            { opacity: 0, y: 8 },
            {
              opacity: 1,
              y: 0,
              duration: 0.5,
              ease: 'power3.out',
              delay: 1.25,
            },
          );
        }

        if (scanRef.current) {
          gsap.fromTo(
            scanRef.current,
            { top: '0%', opacity: 0.6 },
            {
              top: '100%',
              opacity: 0,
              duration: 1.4,
              ease: 'power1.inOut',
              delay: 0.9,
            },
          );
        }

        gsap.to(frame, {
          y: -6,
          duration: 3.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 1.5,
        });
      }, frame);

      const onMove = (e: MouseEvent): void => {
        const rect = frame.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(frame, {
          rotateY: px * 10,
          rotateX: -py * 8,
          duration: 0.6,
          ease: 'power2.out',
        });
      };

      frame.addEventListener('mousemove', onMove, { passive: true });
      removeMove = () => frame.removeEventListener('mousemove', onMove);
    })();

    return () => {
      ctx?.revert();
      removeMove?.();
    };
  }, [reduced]);

  return (
    <div className="hero-preview-perspective w-full max-w-[440px]">
      <div
        ref={frameRef}
        className={`hero-preview-frame relative overflow-hidden rounded-xl border border-white/[0.1] bg-[#0f0d14]/95 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${reduced ? '' : 'opacity-0'}`}
      >
        {/* Scan beam */}
        <div
          ref={scanRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-green-500/25 via-green-400/10 to-transparent"
        />

        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0f0d14]/80 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="size-7 rounded-full bg-zinc-800 ring-1 ring-white/[0.06] grid place-items-center font-mono text-[10px] text-green-400">
              s
            </span>
            <div>
              <p className="text-xs font-medium text-zinc-200">senix-bot</p>
              <p className="text-[10px] text-zinc-500">commented on PR #847</p>
            </div>
          </div>
          <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
            High risk
          </span>
        </div>

        {/* Diff body */}
        <div className="relative p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono">src/api/user.ts</span>
            <span>+3 −1</span>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-black/40 font-mono text-[10px] leading-[1.7] sm:text-[11px]">
            {DIFF_LINES.map((line, i) => (
              <div
                key={i}
                data-preview-line={reduced ? undefined : ''}
                className={`flex ${lineTone(line.type)} ${reduced ? '' : 'opacity-0'}`}
              >
                <span className="w-8 shrink-0 select-none border-r border-white/[0.04] py-px text-right pr-2 text-zinc-600 tabular-nums">
                  {line.n}
                </span>
                <pre className="flex-1 overflow-x-auto px-2 py-px whitespace-pre">{line.text}</pre>
              </div>
            ))}
          </div>

          {/* AI insight */}
          <div
            data-preview-comment={reduced ? undefined : ''}
            className={`mt-3 rounded-[8px] border border-green-500/25 bg-green-500/[0.07] p-3 ${reduced ? '' : 'opacity-0'}`}
          >
            <p className="text-[11px] font-medium text-zinc-200">Behavioral summary</p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
              Outbound auth added with env-sourced token. Verify secret rotation and header handling before merge.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {['auth-change', 'hardcoded-secret'].map((tag) => (
                <code
                  key={tag}
                  className="rounded bg-zinc-900/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400"
                >
                  {tag}
                </code>
              ))}
            </div>
          </div>
        </div>

        {/* Footer meta */}
        <div className="border-t border-white/[0.06] px-4 py-2.5 text-[10px] text-zinc-600">
          Analyzed in <span className="font-mono text-green-400/90">28s</span> · deepseek · 1,287 tokens
        </div>
      </div>
    </div>
  );
}
