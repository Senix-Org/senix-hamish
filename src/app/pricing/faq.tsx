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
 * Lightweight accessible accordion for the pricing FAQ. Only one panel
 * may be open at a time; opening another collapses the previous so the
 * page never grows unboundedly.
 */
export function Faq({ items }: FaqProps): React.ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 divide-y divide-zinc-800 overflow-hidden">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-zinc-100 hover:bg-zinc-900/50 transition-colors"
            >
              <span className="font-medium">{item.q}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-zinc-500 transition-transform ${
                  isOpen ? 'rotate-180 text-zinc-300' : ''
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
                  <p className="px-5 pb-5 text-sm text-zinc-400 leading-relaxed">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
