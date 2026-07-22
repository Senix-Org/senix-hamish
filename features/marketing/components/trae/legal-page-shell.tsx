'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { SiteNav } from '@features/shared/components/site-nav';
import { TraeFooterSection } from './footer-section';
import { TraeHeroBackground } from './hero-background';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export type LegalTocItem = {
  id: string;
  label: string;
};

type TraeLegalPageShellProps = {
  titleLead: string;
  titleAccent: string;
  description: string;
  lastModified: string;
  toc: readonly LegalTocItem[];
  tocAriaLabel: string;
  children: ReactNode;
};

/**
 * Shared marketing chrome for long-form legal pages: Trae hero backdrop,
 * sticky TOC, and privacy-prose article column.
 */
export function TraeLegalPageShell({
  titleLead,
  titleAccent,
  description,
  lastModified,
  toc,
  tocAriaLabel,
  children,
}: TraeLegalPageShellProps): React.ReactElement {
  const heroRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !heroRef.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const targets = heroRef.current?.querySelectorAll('[data-legal-reveal]');
      if (!targets?.length) return;

      ctx = gsap.context(() => {
        gsap.fromTo(
          targets,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            ease: 'power3.out',
            stagger: 0.08,
            delay: 0.04,
          },
        );
      }, heroRef);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  const hidden = reduced ? '' : 'opacity-0';

  return (
    <div className="trae-site">
      <div className="trae-page-gradient" aria-hidden />
      <SiteNav variant="trae" />

      <main>
        <section
          ref={heroRef}
          className="trae-legal-hero relative overflow-hidden border-b border-white/[0.06]"
        >
          <TraeHeroBackground />

          <div className="trae-section relative z-10 pb-16 pt-20 md:pb-20 md:pt-28">
            <p
              data-legal-reveal
              className={`font-mono text-[11px] uppercase tracking-[0.22em] text-[#32f08c]/80 ${hidden}`}
            >
              Legal
            </p>
            <h1
              data-legal-reveal
              className={`mt-4 max-w-3xl text-4xl font-medium tracking-tight text-[#ffffff] md:text-6xl md:leading-[1.05] ${hidden}`}
            >
              {titleLead}{' '}
              <span className="trae-gradient-text trae-privacy-accent">{titleAccent}</span>
            </h1>
            <p
              data-legal-reveal
              className={`mt-5 max-w-xl text-base leading-relaxed text-[#c9c5d2] md:text-lg ${hidden}`}
            >
              {description}
            </p>
            <p
              data-legal-reveal
              className={`mt-6 font-mono text-xs text-[#8b8794] ${hidden}`}
            >
              Last modified: {lastModified}
            </p>
          </div>
        </section>

        <div className="trae-section py-14 md:py-20">
          <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
            <aside className="hidden lg:block">
              <nav
                aria-label={tocAriaLabel}
                className="sticky top-24 space-y-1 border-l border-white/[0.08] pl-4"
              >
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[#8b8794]">
                  On this page
                </p>
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block py-1 text-[13px] leading-snug text-[#8b8794] transition hover:text-[#ffffff]"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </aside>

            <article className="privacy-prose max-w-3xl">{children}</article>
          </div>
        </div>
      </main>

      <TraeFooterSection />
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <section id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      {children}
    </section>
  );
}
