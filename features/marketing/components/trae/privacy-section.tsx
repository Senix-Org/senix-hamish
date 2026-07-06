'use client';

import { History, Lock, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { useTraeReveal } from '../../hooks/use-trae-reveal';

const CARDS: {
  title: string;
  body: string;
  icon: LucideIcon;
}[] = [
  {
    title: 'Data Privacy Protection',
    body:
      'Senix analyzes PR diffs on demand, not your full codebase. Summaries and risk tags are stored for your dashboard. Enable or disable analysis per repo from your settings.',
    icon: History,
  },
  {
    title: 'Secure Data Access',
    body:
      'All traffic is encrypted in transit. GitHub webhooks are signature-verified on every delivery. Supabase row-level security keeps each account isolated to its own installations and reviews.',
    icon: Lock,
  },
  {
    title: 'Scoped GitHub Access',
    body:
      'Install on selected repos only, with the minimum GitHub App permissions required for PR review. Revoke access anytime from GitHub or your Senix dashboard.',
    icon: ShieldCheck,
  },
];

/** TRAE-style privacy and security card row with Senix copy. */
export function TraePrivacySection(): React.ReactElement {
  const ref = useTraeReveal<HTMLElement>({ childSelector: '[data-trae-item]', stagger: 0.08 });
  const accentRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !accentRef.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      ctx = gsap.context(() => {
        gsap.to(accentRef.current, {
          backgroundPosition: '200% center',
          duration: 5,
          ease: 'none',
          repeat: -1,
          delay: 0.5,
        });
      });
    })();

    return () => ctx?.revert();
  }, [reduced]);

  return (
    <section ref={ref} className="trae-section border-t border-white/[0.08] py-20 md:py-28">
      <div data-trae-item className="mx-auto max-w-3xl text-center opacity-0">
        <h2 className="text-3xl font-medium tracking-tight text-[#f5f9fe] md:text-5xl md:leading-tight">
          Privacy and{' '}
          <span ref={accentRef} className="trae-privacy-accent trae-gradient-text inline-block">
            Security
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#a6aab5] md:text-lg">
          Senix prioritizes protecting your code and account data, with minimal collection and
          transparent GitHub App permissions.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
        {CARDS.map(({ title, body, icon: Icon }) => (
          <article
            key={title}
            data-trae-item
            className="trae-privacy-card trae-card trae-spotlight trae-card-gradient-border group flex min-h-[260px] flex-col p-6 opacity-0 md:min-h-[300px] md:p-8"
          >
            <div className="trae-spotlight-inner" />
            <h3 className="text-lg font-medium text-[#f5f9fe] md:text-xl">{title}</h3>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-[#a6aab5] md:text-[15px]">
              {body}
            </p>
            <Icon
              size={22}
              strokeWidth={1.75}
              className="trae-privacy-icon mt-8 shrink-0 text-[#32f08c] transition duration-300 group-hover:drop-shadow-[0_0_12px_rgba(50,240,140,0.55)]"
              aria-hidden
            />
          </article>
        ))}
      </div>
    </section>
  );
}
