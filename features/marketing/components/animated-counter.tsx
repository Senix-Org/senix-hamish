'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/use-reduced-motion';

type AnimatedCounterProps = {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  decimals?: number;
  /** Animate on mount instead of waiting for scroll. */
  startOnMount?: boolean;
};

/**
 * Counts up to `value` when scrolled into view (or on mount for hero stats).
 */
export function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  duration = 1.6,
  className = '',
  decimals = 0,
  startOnMount = false,
}: AnimatedCounterProps): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }

    let ctx: { revert: () => void } | undefined;
    const obj = { val: 0 };

    void (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      if (!ref.current) return;

      ctx = gsap.context(() => {
        const tweenConfig = {
          val: value,
          duration,
          ease: 'power2.out',
          onUpdate: () => {
            setDisplay(Number(obj.val.toFixed(decimals)));
          },
        };

        if (startOnMount) {
          gsap.to(obj, tweenConfig);
        } else {
          gsap.to(obj, {
            ...tweenConfig,
            scrollTrigger: {
              trigger: ref.current,
              start: 'top 90%',
              once: true,
            },
          });
        }
      }, ref);
    })();

    return () => ctx?.revert();
  }, [value, duration, reduced, decimals, startOnMount]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('en-US');

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
