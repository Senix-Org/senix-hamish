'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from './use-reduced-motion';

type TraeRevealOptions = {
  y?: number;
  stagger?: number;
  childSelector?: string;
  start?: string;
};

/** GSAP ScrollTrigger reveal matching TRAE scroll narrative. */
export function useTraeReveal<T extends HTMLElement>(options: TraeRevealOptions = {}): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const { y = 24, stagger = 0.08, childSelector, start = 'top 85%' } = options;

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

      const targets = childSelector
        ? ref.current!.querySelectorAll(childSelector)
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
            scrollTrigger: {
              trigger: ref.current,
              start,
              once: true,
            },
          },
        );
      }, ref);
    })();

    return () => ctx?.revert();
  }, [reduced, y, stagger, childSelector, start]);

  return ref;
}
