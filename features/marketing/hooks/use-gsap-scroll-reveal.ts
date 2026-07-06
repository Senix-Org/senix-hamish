'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from './use-reduced-motion';

type ScrollRevealOptions = {
  y?: number;
  stagger?: number;
  childSelector?: string;
  start?: string;
  delay?: number;
};

/**
 * Fade/slide children into view once when the container enters the viewport.
 * No-ops when prefers-reduced-motion is set.
 */
export function useGsapScrollReveal<T extends HTMLElement>(
  options: ScrollRevealOptions = {},
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const { y = 28, stagger = 0.1, childSelector, start = 'top 85%', delay = 0 } = options;

  useEffect(() => {
    if (reduced) {
      if (ref.current) {
        const targets = childSelector
          ? ref.current.querySelectorAll(childSelector)
          : [ref.current];
        targets.forEach((el) => {
          (el as HTMLElement).style.opacity = '1';
          (el as HTMLElement).style.transform = 'none';
        });
      }
      return;
    }

    if (!ref.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      if (!ref.current) return;

      const targets = childSelector
        ? ref.current.querySelectorAll(childSelector)
        : ref.current;

      ctx = gsap.context(() => {
        gsap.fromTo(
          targets,
          { opacity: 0, y },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            ease: 'power3.out',
            stagger,
            delay,
            scrollTrigger: {
              trigger: ref.current,
              start,
              once: true,
            },
          },
        );
      }, ref);
    })();

    return () => {
      ctx?.revert();
    };
  }, [reduced, y, stagger, childSelector, start, delay]);

  return ref;
}
