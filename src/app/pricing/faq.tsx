'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

type FaqItem = {
  q: string;
  a: string;
};

type FaqProps = {
  items: FaqItem[];
};

/**
 * Accessible accordion for the pricing FAQ. One panel open at a time.
 */
export function Faq({ items }: FaqProps): React.ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-surface divide-y divide-surface-border">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-primary transition-colors hover:bg-surface-raised"
            >
              <span className="font-medium">{item.q}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-muted transition-transform ${
                  isOpen ? 'rotate-180 text-secondary' : ''
                }`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-secondary">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
