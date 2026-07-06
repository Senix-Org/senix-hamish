'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/use-reduced-motion';

type HeroGlowProps = {
  className?: string;
};

/**
 * Layered green radial glow with breathing animation and mouse parallax.
 */
export function HeroGlow({ className = '' }: HeroGlowProps): React.ReactElement {
  const primaryRef = useRef<HTMLDivElement>(null);
  const secondaryRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !primaryRef.current) return;

    let ctx: { revert: () => void } | undefined;
    let raf = 0;
    let removeMove: (() => void) | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;

      ctx = gsap.context(() => {
        gsap.to(primaryRef.current, {
          scale: 1.08,
          opacity: 1,
          duration: 5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });

        if (secondaryRef.current) {
          gsap.to(secondaryRef.current, {
            scale: 1.12,
            opacity: 0.7,
            duration: 6.5,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            delay: 1.2,
          });
        }
      });

      const onMove = (e: MouseEvent): void => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const x = (e.clientX / window.innerWidth - 0.5) * 32;
          const y = (e.clientY / window.innerHeight - 0.5) * 20;
          gsap.to(primaryRef.current, { x, y, duration: 1, ease: 'power2.out' });
          gsap.to(secondaryRef.current, {
            x: x * 0.5,
            y: y * 0.5,
            duration: 1.2,
            ease: 'power2.out',
          });
        });
      };

      window.addEventListener('mousemove', onMove, { passive: true });
      removeMove = () => window.removeEventListener('mousemove', onMove);
    })();

    return () => {
      ctx?.revert();
      removeMove?.();
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <>
      <div
        ref={primaryRef}
        aria-hidden
        className={`pointer-events-none absolute -top-24 left-1/2 h-[480px] w-[640px] -translate-x-1/2 opacity-90 bg-glow-green ${className}`}
      />
      <div
        ref={secondaryRef}
        aria-hidden
        className={`pointer-events-none absolute top-20 left-1/2 h-[320px] w-[480px] -translate-x-1/3 opacity-50 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.14)_0%,transparent_70%)] ${className}`}
      />
    </>
  );
}
