'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { HeroAuthCta } from '@features/shared/components/auth-cta';
import { TraeButton } from '../ui/trae-button';
import { TraeHeroBackground } from './hero-background';
import { TraeSoloTiles } from './solo-tiles';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

/**
 * TRAE.ai hero layout with dot-matrix background and bottom-right CTA block.
 */
export function TraeHeroSection(): React.ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !sectionRef.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const targets = sectionRef.current?.querySelectorAll('[data-trae-reveal]');
      if (!targets?.length) return;

      ctx = gsap.context(() => {
        gsap.fromTo(
          targets,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.07,
            delay: 0.05,
          },
        );

        const accent = sectionRef.current?.querySelector('.trae-hero-accent');
        if (accent) {
          gsap.to(accent, {
            backgroundPosition: '200% center',
            duration: 6,
            ease: 'none',
            repeat: -1,
            delay: 0.8,
          });
        }
      }, sectionRef);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  const hidden = reduced ? '' : 'opacity-0';

  return (
    <section ref={sectionRef} className="trae-hero relative overflow-hidden">
      <TraeHeroBackground />

      <div className="trae-hero-inner relative z-10 flex flex-col">
        <div aria-hidden className="trae-hero-topline hidden md:block" data-trae-reveal />

        <div className="trae-hero-main">
          <div className={`trae-hero-titlebox ${hidden}`} data-trae-reveal>
            <div className="mb-5">
              <Link href="/dashboard/connect" className="trae-announcement-pill">
                <span className="trae-announcement-badge">New</span>
                <span>MCP integration for Cursor and Claude Code</span>
                <ChevronRight
                  size={13}
                  className="text-[#32f08c] transition group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
            <div className="trae-hero-title2">AI code review</div>
            <div className="trae-hero-title1">
              for your{' '}
              <span className="trae-hero-accent trae-gradient-text">pull requests.</span>
            </div>
          </div>
        </div>

        <div className="trae-hero-bottom flex flex-1 flex-col justify-end">
          <div className="trae-hero-bottom-row flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div data-trae-reveal className={hidden}>
              <TraeSoloTiles className="pt-0" />
            </div>

            <div className={`trae-hero-corner ${hidden}`} data-trae-reveal>
              <div className="trae-hero-desc">
                <p>
                  Senix reads every PR your team opens and posts a behavioral summary with risk level
                  as a comment within 30 seconds.
                </p>
                <p>Built for teams shipping with Cursor, Copilot, and Claude Code.</p>
              </div>

              <div className="mt-3 flex flex-row flex-wrap justify-end gap-3">
                <span className="trae-shimmer-btn inline-flex rounded-md">
                  <HeroAuthCta trae />
                </span>
                <TraeButton variant="outline" href="#how-it-works">
                  See how it works
                </TraeButton>
              </div>

              <Link href="/playground" className="trae-hero-link group">
                Try the playground
                <ChevronRight
                  size={16}
                  className="text-[#a6aab5] transition group-hover:translate-x-0.5 group-hover:text-[#f5f9fe]"
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
