'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { HeroAuthCta } from '@features/shared/components/auth-cta';
import { TraeButton } from './ui/trae-button';
import { useReducedMotion } from '../hooks/use-reduced-motion';

/**
 * TRAE.ai hero layout: left headline stack, right descriptions + dual CTAs.
 * Senix copy and brand colors; structure matches trae.ai.
 */
export function HeroSection(): React.ReactElement {
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
      }, sectionRef);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  const hidden = reduced ? '' : 'opacity-0';

  return (
    <section ref={sectionRef} className="trae-hero">
      <div className="trae-hero-inner">
        {/* Top divider (TRAE tablet+) */}
        <div aria-hidden className="trae-hero-topline hidden md:block" data-trae-reveal />

        <div className="trae-hero-body">
          {/* Left: headline stack */}
          <div className="trae-hero-main">
            <div className={`trae-hero-titlebox ${hidden}`} data-trae-reveal>
              <div className="trae-hero-title2">AI code review</div>
              <div className="trae-hero-title1">for your pull requests.</div>
            </div>
          </div>

          {/* Right: descriptions + CTAs */}
          <div className="trae-hero-side">
            <div className={`trae-hero-desc ${hidden}`} data-trae-reveal>
              <p>
                Senix reads every PR your team opens and posts a behavioral summary with risk level
                as a comment within 30 seconds.
              </p>
              <p>
                Built for teams shipping with Cursor, Copilot, and Claude Code.
              </p>
            </div>

            <div
              className={`flex flex-row flex-wrap gap-3 ${hidden}`}
              data-trae-reveal
            >
              <HeroAuthCta trae />
              <TraeButton variant="outline" href="#how-it-works">
                See how it works
              </TraeButton>
            </div>

            <Link
              href="/playground"
              className={`trae-hero-link group ${hidden}`}
              data-trae-reveal
            >
              Try the playground
              <ChevronRight
                size={16}
                className="text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-300"
                aria-hidden
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
