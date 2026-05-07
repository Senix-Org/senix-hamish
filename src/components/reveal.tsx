'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
};

/**
 * Fade + translate-up children when they scroll into view. Honors the
 * user's reduced-motion preference by skipping animation entirely.
 *
 * Use sparingly — at most one wrapper per visual block. Avoid wrapping
 * each list item; pass a single `Reveal` around the list and use
 * `RevealStagger` if children need to stagger.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  once = true,
}: RevealProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

type RevealStaggerProps = {
  children: ReactNode;
  className?: string;
  staggerMs?: number;
};

/**
 * Staggers direct children with a uniform delay between them. Children
 * must be wrapped in `RevealItem` for the animation to apply.
 */
export function RevealStagger({
  children,
  className,
  staggerMs = 60,
}: RevealStaggerProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: staggerMs / 1000 },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * One slot inside a `RevealStagger`. Inherits stagger timing from its
 * parent variant context.
 */
export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
