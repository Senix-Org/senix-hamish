'use client';

import { useEffect, useRef } from 'react';
import { HeroAuthCta } from '@features/shared/components/auth-cta';
import { TraeButton } from '../ui/trae-button';
import { TraeHeroBackground } from './hero-background';
import { HeroProductPreview } from '../hero-product-preview';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

/**
 * CodeRabbit-inspired hero: brand, one claim, short support, CTA pair,
 * and a full-bleed product preview as the visual anchor.
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
          { opacity: 0, y: 22 },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            ease: 'power3.out',
            stagger: 0.08,
            delay: 0.04,
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

      <div className="trae-hero-inner relative z-10">
        <div className="trae-hero-copy">
          <div className={`trae-hero-brand ${hidden}`} data-trae-reveal>
            Senix
          </div>

          <h1 className={`trae-hero-headline ${hidden}`} data-trae-reveal>
            Cut code review time{' '}
            <span className="trae-hero-accent trae-gradient-text">&amp; risk</span>
            , instantly.
          </h1>

          <p className={`trae-hero-sub ${hidden}`} data-trae-reveal>
            Behavioral PR summaries for AI-powered teams who move fast without shipping blind.
          </p>

          <div className={`trae-hero-actions ${hidden}`} data-trae-reveal>
            <span className="trae-shimmer-btn inline-flex rounded-lg">
              <HeroAuthCta trae />
            </span>
            <TraeButton variant="outline" href="/playground">
              Try playground
            </TraeButton>
          </div>
        </div>

        <div className={`trae-hero-visual ${hidden}`} data-trae-reveal>
          <HeroProductPreview />
        </div>
      </div>
    </section>
  );
}
