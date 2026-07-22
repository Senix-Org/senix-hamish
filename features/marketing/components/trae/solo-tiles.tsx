'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

const TILES = [
  {
    href: '#product',
    label: 'PR',
    accent: 'Reviews',
    desc: 'GitHub comments',
  },
  {
    href: '/dashboard/connect',
    label: 'IDE',
    accent: '+ MCP',
    desc: 'Cursor · Claude Code',
  },
] as const;

/** TRAE solo intro square tiles at the bottom of the hero. */
export function TraeSoloTiles({ className = '' }: { className?: string }): React.ReactElement {
  const rowRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !rowRef.current) return;

    const tiles = rowRef.current.querySelectorAll('.trae-solo-tile');
    const cleanups: (() => void)[] = [];

    tiles.forEach((tile) => {
      const el = tile as HTMLElement;

      const onEnter = (): void => {
        void (async () => {
          const gsap = (await import('gsap')).default;
          gsap.to(el, {
            y: -4,
            scale: 1.03,
            borderColor: 'rgba(50, 240, 140, 0.45)',
            boxShadow: '0 12px 40px -16px rgba(50, 240, 140, 0.35)',
            duration: 0.35,
            ease: 'power2.out',
          });
        })();
      };

      const onLeave = (): void => {
        void (async () => {
          const gsap = (await import('gsap')).default;
          gsap.to(el, {
            y: 0,
            scale: 1,
            borderColor: 'rgba(255, 255, 255, 0.12)',
            boxShadow: '0 0 0 transparent',
            duration: 0.4,
            ease: 'power2.out',
          });
        })();
      };

      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [reduced]);

  return (
    <div ref={rowRef} className={`trae-solo-row flex items-center gap-3 pt-5 ${className}`}>
      {TILES.map(({ href, label, accent, desc }) => (
        <Link
          key={href}
          href={href}
          className="trae-solo-tile group flex aspect-square w-32 flex-col justify-between border border-white/[0.12] bg-[#121314] p-2 transition-colors sm:w-[136px] xl:w-[178px]"
          style={{
            backgroundImage: 'radial-gradient(rgba(150,170,158,0.06) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        >
          <span className="font-mono text-[13px] font-medium text-[#ffffff]">{label}</span>
          <div>
            <span className="trae-gradient-text block font-mono text-[13px] font-medium">{accent}</span>
            <span className="mt-1 block text-[10px] text-[#8b8794] transition group-hover:text-[#c9c5d2]">
              {desc}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
