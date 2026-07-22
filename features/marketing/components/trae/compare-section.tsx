'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

const WITHOUT = [
  '800+ lines to read on every PR',
  'Secrets and auth changes slip through at 2am',
  'Review threads full of style nits',
  'No shared signal for junior reviewers',
];

const WITH = [
  'Behavioral summary in under 30 seconds',
  'Risk tags: hardcoded-secret, sql-injection, auth-change',
  'Focus files pointing at what actually changed',
  'Same review quality on every PR, every repo',
];

/** Before/after contrast band showing manual review vs Senix. */
export function TraeCompareSection(): React.ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
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

      const label = section.querySelector('[data-compare-label]');
      const title = section.querySelector('[data-compare-title]');
      const withoutCol = section.querySelector('[data-compare-without]');
      const withCol = section.querySelector('[data-compare-with]');
      const arrow = section.querySelector('[data-compare-arrow]');
      const withoutItems = section.querySelectorAll('[data-compare-without-item]');
      const withItems = section.querySelectorAll('[data-compare-with-item]');

      if (reduced) {
        [label, title, withoutCol, withCol, arrow, ...withoutItems, ...withItems].forEach((el) => {
          if (el) gsap.set(el, { opacity: 1, x: 0, y: 0, scale: 1 });
        });
        return;
      }

      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            once: true,
          },
        });

        tl.fromTo(
          label,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
        )
          .fromTo(
            title,
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.65, ease: 'power4.out' },
            '-=0.25',
          )
          .fromTo(
            withoutCol,
            { opacity: 0, x: -28 },
            { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' },
            '-=0.3',
          )
          .fromTo(
            withCol,
            { opacity: 0, x: 28 },
            { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' },
            '-=0.55',
          )
          .fromTo(
            arrow,
            { opacity: 0, scale: 0.6 },
            { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' },
            '-=0.45',
          )
          .fromTo(
            withoutItems,
            { opacity: 0, x: -12 },
            { opacity: 1, x: 0, duration: 0.45, ease: 'power2.out', stagger: 0.07 },
            '-=0.35',
          )
          .fromTo(
            withItems,
            { opacity: 0, x: 12 },
            { opacity: 1, x: 0, duration: 0.45, ease: 'power2.out', stagger: 0.07 },
            '-=0.4',
          );

        gsap.to(section.querySelector('[data-compare-glow]'), {
          opacity: 0.85,
          scale: 1.05,
          duration: 5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }, section);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  const hidden = reduced ? '' : 'opacity-0';

  return (
    <section ref={sectionRef} className="trae-compare-section relative overflow-hidden py-20 md:py-28">
      {/* Top glow line — CodeRabbit separator style */}
      <div className="trae-glow-separator absolute inset-x-0 top-0" aria-hidden />

      <div
        data-compare-glow
        aria-hidden
        className="pointer-events-none absolute right-[8%] top-1/2 h-[440px] w-[560px] -translate-y-1/2 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(50, 240, 140,0.14) 0%, rgba(50, 240, 140,0.04) 45%, transparent 70%)',
        }}
      />

      <div className="trae-section relative">
        <p data-compare-label className={`trae-section-label ${hidden}`}>
          The difference
        </p>
        <h2
          data-compare-title
          className={`trae-section-title max-w-2xl ${hidden}`}
        >
          Stop drowning in diffs. Start reading risks.
        </h2>

        <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
          <article
            data-compare-without
            className={`trae-compare-panel trae-compare-panel-dim trae-card p-6 md:p-8 ${hidden}`}
          >
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b8794]">
              Without Senix
            </p>
            <ul className="mt-6 space-y-4">
              {WITHOUT.map((item) => (
                <li
                  key={item}
                  data-compare-without-item
                  className={`flex items-start gap-3 text-sm text-[#8b8794] ${hidden}`}
                >
                  <X size={16} className="mt-0.5 shrink-0 text-[#8b8794]/80" strokeWidth={2} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <div
            data-compare-arrow
            className={`trae-compare-arrow hidden items-center justify-center self-center lg:flex ${hidden}`}
            aria-hidden
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#32f08c]/30 bg-[#32f08c]/10">
              <ArrowRight size={18} className="text-[#32f08c]" />
            </div>
          </div>

          <article
            data-compare-with
            className={`trae-compare-panel trae-compare-panel-lit trae-card trae-spotlight p-6 md:p-8 ${hidden}`}
          >
            <div className="trae-spotlight-inner" />
            {/* CodeRabbit-style top glowing line */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(50, 240, 140,0.6) 40%, rgba(160, 253, 231,0.5) 60%, transparent 100%)',
              }}
            />
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#32f08c]">
              With Senix
            </p>
            <ul className="mt-6 space-y-4">
              {WITH.map((item) => (
                <li
                  key={item}
                  data-compare-with-item
                  className={`flex items-start gap-3 text-sm text-[#d8dce3] ${hidden}`}
                >
                  <Check size={16} className="mt-0.5 shrink-0 text-[#32f08c]" strokeWidth={2.5} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
