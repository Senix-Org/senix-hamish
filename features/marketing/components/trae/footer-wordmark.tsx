'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

const LETTERS = ['S', 'E', 'N', 'I', 'X'] as const;

/** Full-width animated SENIX wordmark at the footer base. */
export function TraeFooterWordmark(): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!wrapRef.current || !textRef.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const wrap = wrapRef.current;
      const chars = textRef.current?.querySelectorAll('[data-footer-char]');
      if (!wrap || !chars?.length) return;

      if (reduced) {
        gsap.set(chars, { opacity: 1, y: 0, rotateX: 0 });
        return;
      }

      ctx = gsap.context(() => {
        gsap.fromTo(
          wrap,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.4,
            scrollTrigger: {
              trigger: wrap,
              start: 'top 95%',
              once: true,
            },
          },
        );

        gsap.fromTo(
          chars,
          { y: 48, opacity: 0, rotateX: -40, transformOrigin: '50% 100%' },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 1,
            ease: 'power4.out',
            stagger: 0.07,
            scrollTrigger: {
              trigger: wrap,
              start: 'top 92%',
              once: true,
            },
          },
        );

        gsap.to(chars, {
          y: -4,
          duration: 2.8,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          stagger: { each: 0.18, from: 'center' },
          delay: 1.2,
        });

        /* subtle stroke brightening pulse — left to right across letters */
        gsap.to(chars, {
          opacity: 0.85,
          duration: 3,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          stagger: { each: 0.22, from: 'start' },
          delay: 1.5,
        });
      }, wrap);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  return (
    <div ref={wrapRef} aria-hidden className="trae-footer-wordmark-wrap">
      <p ref={textRef} className="trae-footer-wordmark">
        {LETTERS.map((char) => (
          <span key={char} data-footer-char className="trae-footer-wordmark-char">
            {char}
          </span>
        ))}
      </p>
    </div>
  );
}
