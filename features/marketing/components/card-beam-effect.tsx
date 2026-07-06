'use client';

import { useEffect } from 'react';
import { useReducedMotion } from '../hooks/use-reduced-motion';

/**
 * Attaches a travelling green border-beam to every `.trae-card` element.
 * Drives a conic-gradient via `--beam-angle` CSS variable using rAF,
 * visible only in the card's 1px border ring via CSS mask-composite.
 * Renders nothing — pure side-effect component.
 */
export function CardBeamEffect(): null {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const cards = Array.from(document.querySelectorAll<HTMLElement>('.trae-card'));
    const cleanups: (() => void)[] = [];

    for (const card of cards) {
      let raf = 0;
      let angle = Math.random() * 360;
      let running = false;

      const tick = (): void => {
        if (!running) return;
        angle = (angle + 1.8) % 360;
        card.style.setProperty('--beam-angle', `${angle}deg`);
        raf = requestAnimationFrame(tick);
      };

      const onEnter = (): void => {
        running = true;
        card.style.setProperty('--beam-opacity', '1');
        raf = requestAnimationFrame(tick);
      };

      const onLeave = (): void => {
        running = false;
        cancelAnimationFrame(raf);
        card.style.setProperty('--beam-opacity', '0');
      };

      card.addEventListener('mouseenter', onEnter, { passive: true });
      card.addEventListener('mouseleave', onLeave, { passive: true });

      cleanups.push(() => {
        running = false;
        cancelAnimationFrame(raf);
        card.removeEventListener('mouseenter', onEnter);
        card.removeEventListener('mouseleave', onLeave);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, [reduced]);

  return null;
}
