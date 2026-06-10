'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NavLink } from './site-nav';
import { MobileAuthCta } from './auth-cta';

type MobileMenuProps = {
  links: NavLink[];
};

/**
 * Hamburger trigger + full-screen panel for the mobile breakpoint of the
 * top nav. Locks body scroll while open and closes itself on link tap.
 */
export function MobileMenu({ links }: MobileMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="md:hidden flex items-center">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="p-2 -mr-2 text-zinc-300 hover:text-zinc-100"
      >
        <Menu size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-md flex flex-col"
          >
            <div className="h-14 px-5 flex items-center justify-between border-b border-zinc-800/60">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
                <img src="/logo.png" alt="" className="h-7 w-7 rounded-md" />
                <span className="font-mono text-sm text-zinc-100">senix</span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="p-2 -mr-2 text-zinc-300 hover:text-zinc-100"
              >
                <X size={20} />
              </button>
            </div>

            <motion.nav
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
              }}
              className="flex-1 px-6 py-10 flex flex-col gap-1"
            >
              {links.map((l) => (
                <motion.div
                  key={l.href}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                  }}
                >
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 text-2xl font-medium text-zinc-100 border-b border-zinc-800/60"
                  >
                    {l.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                }}
                className="mt-8 flex flex-col gap-3"
              >
                <MobileAuthCta />
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
