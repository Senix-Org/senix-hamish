'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import SignInButton from '@features/shared/components/sign-in-button';
import { TraeButton } from '../ui/trae-button';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

const HEADLINE_WORDS = ['Stop', 'reading', 'every', 'line.'] as const;

/** Final CTA with GSAP scroll choreography and ambient glow motion. */
export function TraeFinalCtaSection(): React.ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  const glowARef = useRef<HTMLDivElement>(null);
  const glowBRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!sectionRef.current) return;

    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const section = sectionRef.current;
      if (!section) return;

      const label = section.querySelector('[data-cta-label]');
      const words = section.querySelectorAll('[data-cta-word]');
      const accent = section.querySelector('[data-cta-accent]');
      const desc = section.querySelector('[data-cta-desc]');
      const actionItems = section.querySelectorAll('[data-cta-action]');
      const footnote = section.querySelector('[data-cta-footnote]');

      if (reduced) {
        [label, accent, desc, footnote, ...words, ...actionItems].forEach((el) => {
          if (el) gsap.set(el, { opacity: 1, y: 0, filter: 'none', scale: 1 });
        });
        return;
      }

      ctx = gsap.context(() => {
        if (glowARef.current && glowBRef.current) {
          gsap.to(glowARef.current, {
            x: 40,
            y: 20,
            scale: 1.08,
            duration: 5,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          });
          gsap.to(glowBRef.current, {
            x: -30,
            y: -16,
            scale: 1.12,
            duration: 6.5,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            delay: 0.6,
          });
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 78%',
            once: true,
          },
        });

        tl.fromTo(
          label,
          { opacity: 0, y: 24, filter: 'blur(8px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.65, ease: 'power3.out' },
        )
          .fromTo(
            words,
            { opacity: 0, y: 36, rotateX: -28, transformOrigin: '50% 100%' },
            {
              opacity: 1,
              y: 0,
              rotateX: 0,
              duration: 0.75,
              ease: 'power4.out',
              stagger: 0.06,
            },
            '-=0.35',
          )
          .fromTo(
            accent,
            { opacity: 0, y: 28, scale: 0.94, filter: 'blur(6px)' },
            { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.85, ease: 'power3.out' },
            '-=0.45',
          )
          .fromTo(
            desc,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' },
            '-=0.4',
          )
          .fromTo(
            actionItems,
            { opacity: 0, y: 18, scale: 0.96 },
            { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.4)', stagger: 0.1 },
            '-=0.35',
          )
          .fromTo(
            footnote,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
            '-=0.2',
          );

        if (accent) {
          gsap.to(accent, {
            backgroundPosition: '200% center',
            duration: 5,
            ease: 'none',
            repeat: -1,
            delay: 1,
          });
        }
      }, section);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  const hidden = reduced ? '' : 'opacity-0';

  return (
    <section ref={sectionRef} className="trae-final-cta relative overflow-hidden border-t border-white/[0.08]">
      <div
        ref={glowARef}
        aria-hidden
        className="pointer-events-none absolute left-[18%] top-0 h-[520px] w-[640px] -translate-y-1/2 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(50,240,140,0.2) 0%, rgba(50,240,140,0.04) 48%, transparent 72%)',
        }}
      />

      <div
        ref={glowBRef}
        aria-hidden
        className="pointer-events-none absolute right-[12%] top-1/3 h-[380px] w-[480px] opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(160,253,231,0.08) 0%, rgba(50,240,140,0.04) 45%, transparent 70%)',
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(rgba(150,170,158,0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="trae-section relative py-24 text-center md:py-32 lg:py-36">
        <p data-cta-label className={`trae-section-label ${hidden}`}>
          Ready when you are
        </p>

        <h2 className="trae-final-cta-headline mt-5 text-3xl font-medium tracking-tight text-[#f5f9fe] md:text-5xl md:leading-tight lg:text-6xl">
          <span className="inline-flex flex-wrap justify-center gap-x-[0.28em]">
            {HEADLINE_WORDS.map((word) => (
              <span key={word} data-cta-word className={`inline-block ${hidden}`}>
                {word}
              </span>
            ))}
          </span>
          <br />
          <span
            data-cta-accent
            className={`trae-final-cta-accent trae-gradient-text inline-block ${hidden}`}
          >
            Read every risk.
          </span>
        </h2>

        <p
          data-cta-desc
          className={`mx-auto mt-7 max-w-xl text-base leading-relaxed !text-white md:text-lg ${hidden}`}
        >
          Connect GitHub, open a pull request, and get a behavioral review with risk tags in under
          two minutes. Free to start, no card required.
        </p>

      {/* CodeRabbit-style scan line shimmer on the CTA */}
      <div
        data-cta-actions
        className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <div data-cta-action className={`trae-shimmer-btn rounded-md ${hidden}`}>
          <SignInButton label="Get started free" variant="trae" />
        </div>
          <div data-cta-action className={hidden}>
            <TraeButton variant="outline" href="/docs/installation" className="h-10 px-6 xl:h-14">
              Installation guide
            </TraeButton>
          </div>
        </div>

        <p data-cta-footnote className={`mt-7 text-sm text-[#787d87] ${hidden}`}>
          Questions about data handling?{' '}
          <Link
            href="/privacy"
            className="text-[#32f08c] underline-offset-4 transition hover:text-[#3ecf8e] hover:underline"
          >
            Privacy policy
          </Link>
        </p>
      </div>
    </section>
  );
}
