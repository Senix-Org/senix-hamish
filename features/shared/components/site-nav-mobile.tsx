'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NavLink } from './site-nav';
import { MobileAuthCta } from './auth-cta';

type MobileMenuProps = {
  links: NavLink[];
  variant?: 'default' | 'trae';
};

/**
 * Hamburger trigger + full-screen panel for the mobile breakpoint of the
 * top nav. Portaled to document.body so backdrop-filter / sticky on the
 * header cannot trap position:fixed. Locks body scroll while open and
 * closes itself on link tap or Escape.
 */
export function MobileMenu({ links, variant = 'default' }: MobileMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const isTrae = variant === 'trae';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={
            isTrae
              ? 'fixed inset-0 z-[100] flex flex-col bg-[#09080c]/97 backdrop-blur-md'
              : 'fixed inset-0 z-[100] flex flex-col bg-zinc-950/95 backdrop-blur-md'
          }
        >
          <div
            className={
              isTrae
                ? 'flex h-16 items-center justify-between border-b border-white/[0.08] px-4 sm:px-5'
                : 'flex h-14 items-center justify-between border-b border-zinc-800/60 px-5'
            }
          >
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt=""
                className={
                  isTrae
                    ? 'h-7 w-7 rounded-md ring-1 ring-white/10'
                    : 'h-7 w-7 rounded-md'
                }
              />
              <span
                className={
                  isTrae
                    ? 'text-sm font-semibold tracking-tight text-white'
                    : 'font-mono text-sm text-zinc-100'
                }
              >
                senix
              </span>
            </Link>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className={
                isTrae
                  ? 'rounded-md p-2 -mr-1 text-[#c9c5d2] transition hover:bg-white/[0.06] hover:text-white'
                  : 'p-2 -mr-2 text-zinc-300 hover:text-zinc-100'
              }
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
            className={
              isTrae
                ? 'flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-5'
                : 'flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-6 py-10'
            }
            aria-label="Primary"
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
                  className={
                    isTrae
                      ? 'block border-b border-white/[0.06] py-3.5 text-xl font-medium text-white transition hover:text-[#32f08c]'
                      : 'block border-b border-zinc-800/60 py-3 text-2xl font-medium text-zinc-100'
                  }
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
              <MobileAuthCta trae={isTrae} />
            </motion.div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="flex items-center md:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className={
          isTrae
            ? 'rounded-md p-2 -mr-1 text-[#c9c5d2] transition hover:bg-white/[0.06] hover:text-white'
            : 'p-2 -mr-2 text-zinc-300 hover:text-zinc-100'
        }
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mounted ? createPortal(panel, document.body) : null}
    </div>
  );
}
