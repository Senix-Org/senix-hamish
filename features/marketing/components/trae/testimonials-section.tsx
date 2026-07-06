'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

type Testimonial = {
  quote: string;
  name: string;
  handle: string;
};

const ROW_ONE: Testimonial[] = [
  {
    quote:
      'Senix caught a hardcoded API key in a Copilot-generated PR before it merged. Saved us a postmortem.',
    name: 'Néstor M.',
    handle: '@nestordev',
  },
  {
    quote:
      'The risk tags are the whole game. I scan sql-injection and auth-change flags instead of reading 800 lines.',
    name: 'Taishi K.',
    handle: '@taishi_codes',
  },
  {
    quote:
      'We run Senix on every PR now. Thirty seconds and the comment tells me exactly where to look.',
    name: 'Nikita K.',
    handle: '@nikita_k',
  },
  {
    quote:
      'Finally a review bot that talks about behavior, not style nits. Our juniors love the focus files.',
    name: 'Vincent D.',
    handle: '@vincentdelbeau',
  },
];

const ROW_TWO: Testimonial[] = [
  {
    quote:
      'Installed on one repo to try it. Upgraded to Team within a week after it flagged payment logic twice.',
    name: 'Hendrix L.',
    handle: '@hendrixbuilds',
  },
  {
    quote:
      'MCP in Cursor means I get the same risk summary before I even push. Huge for vibe coding sessions.',
    name: 'Nogu S.',
    handle: '@nogu_ship',
  },
  {
    quote:
      'Low noise, high signal. Senix does not flood the thread with essay-length comments.',
    name: 'György M.',
    handle: '@gyorgy_mv',
  },
  {
    quote:
      'The behavioral summary reads like a staff engineer wrote it. Scary accurate on refactors.',
    name: 'Sapien A.',
    handle: '@sapienapp',
  },
];

/** Brand-aligned avatar fills (green/teal spectrum, not random hues). */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, rgba(50,240,140,0.28) 0%, rgba(16,42,32,0.95) 52%, rgba(10,11,13,1) 100%)',
  'linear-gradient(135deg, rgba(62,225,163,0.24) 0%, rgba(20,48,38,0.95) 52%, rgba(10,11,13,1) 100%)',
  'linear-gradient(135deg, rgba(96,242,189,0.22) 0%, rgba(18,44,36,0.95) 52%, rgba(10,11,13,1) 100%)',
  'linear-gradient(135deg, rgba(160,253,231,0.18) 0%, rgba(22,52,42,0.95) 52%, rgba(10,11,13,1) 100%)',
  'linear-gradient(135deg, rgba(50,240,140,0.2) 0%, rgba(14,36,28,0.95) 52%, rgba(10,11,13,1) 100%)',
  'linear-gradient(135deg, rgba(15,220,120,0.26) 0%, rgba(18,46,34,0.95) 52%, rgba(10,11,13,1) 100%)',
  'linear-gradient(135deg, rgba(80,230,160,0.22) 0%, rgba(20,50,38,0.95) 52%, rgba(10,11,13,1) 100%)',
  'linear-gradient(135deg, rgba(110,245,200,0.2) 0%, rgba(16,40,32,0.95) 52%, rgba(10,11,13,1) 100%)',
] as const;

function avatarGradient(name: string): string {
  const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[seed % AVATAR_GRADIENTS.length];
}

function TestimonialCard({ quote, name, handle }: Testimonial): React.ReactElement {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="trae-testimonial-card trae-card flex w-[min(88vw,340px)] shrink-0 flex-col justify-between p-5 md:w-[360px] md:p-6">
      <p className="text-sm leading-relaxed text-[#d8dce3] md:text-[15px]">&ldquo;{quote}&rdquo;</p>
      <div className="mt-6 flex items-center gap-3">
        <div
          className="trae-testimonial-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-[11px] font-medium text-[#f5f9fe] ring-1 ring-[#32f08c]/20"
          style={{ background: avatarGradient(name) }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-medium text-[#f5f9fe]">{name}</p>
          <p className="truncate text-xs text-[#787d87]">{handle}</p>
        </div>
      </div>
    </article>
  );
}

function TestimonialMarquee({
  items,
  direction,
  className = '',
  staticLayout = false,
}: {
  items: Testimonial[];
  direction: 'left' | 'right';
  className?: string;
  staticLayout?: boolean;
}): React.ReactElement {
  const cards = staticLayout ? items : [...items, ...items];

  if (staticLayout) {
    return (
      <div className={`trae-section grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
        {cards.map((item) => (
          <TestimonialCard key={item.handle} {...item} />
        ))}
      </div>
    );
  }

  return (
    <div className={`trae-testimonials-row ${className}`}>
      <div
        className={`trae-testimonials-track ${direction === 'right' ? 'trae-testimonials-track-reverse' : ''}`}
      >
        {cards.map((item, index) => (
          <TestimonialCard key={`${item.handle}-${index}`} {...item} />
        ))}
      </div>
    </div>
  );
}

/** TRAE-style "Loved by Devs" testimonial wall with dual marquee rows. */
export function TraeTestimonialsSection(): React.ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
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

      const label = section.querySelector('[data-testimonials-label]');
      const titleWords = section.querySelectorAll('[data-testimonials-word]');
      const accent = section.querySelector('[data-testimonials-accent]');
      const desc = section.querySelector('[data-testimonials-desc]');
      const marquees = section.querySelector('[data-testimonials-marquees]');
      const cards = section.querySelectorAll('.trae-testimonial-card');

      if (reduced) {
        [label, accent, desc, marquees, ...titleWords, ...cards].forEach((el) => {
          if (el) gsap.set(el, { opacity: 1, y: 0, filter: 'none', scale: 1 });
        });
        return;
      }

      ctx = gsap.context(() => {
        if (glowRef.current) {
          gsap.to(glowRef.current, {
            x: 30,
            y: -12,
            scale: 1.06,
            opacity: 0.9,
            duration: 7,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          });
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 82%',
            once: true,
          },
        });

        tl.fromTo(
          label,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' },
        )
          .fromTo(
            titleWords,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out', stagger: 0.08 },
            '-=0.3',
          )
          .fromTo(
            accent,
            { opacity: 0, y: 24, scale: 0.96, filter: 'blur(6px)' },
            { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.75, ease: 'power3.out' },
            '-=0.45',
          )
          .fromTo(
            desc,
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
            '-=0.4',
          )
          .fromTo(
            marquees,
            { opacity: 0, y: 32 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
            '-=0.35',
          );

        if (accent) {
          gsap.to(accent, {
            backgroundPosition: '200% center',
            duration: 5,
            ease: 'none',
            repeat: -1,
            delay: 0.8,
          });
        }

        gsap.fromTo(
          cards,
          { opacity: 0, y: 20, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.55,
            ease: 'power2.out',
            stagger: 0.04,
            scrollTrigger: {
              trigger: marquees,
              start: 'top 88%',
              once: true,
            },
          },
        );
      }, section);
    })();

    return () => ctx?.revert();
  }, [reduced]);

  const hidden = reduced ? '' : 'opacity-0';

  return (
    <section
      ref={sectionRef}
      className="trae-testimonials-section relative border-y border-white/[0.08] py-20 md:py-28"
    >
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 opacity-70"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(50,240,140,0.1) 0%, rgba(50,240,140,0.03) 42%, transparent 72%)',
        }}
      />

      <div className="trae-section relative text-center">
        <p data-testimonials-label className={`trae-section-label ${hidden}`}>
          Social proof
        </p>
        <h2 className="mt-4 text-3xl font-medium tracking-tight text-[#f5f9fe] md:text-5xl md:leading-tight">
          <span className="inline-flex flex-wrap justify-center gap-x-[0.28em]">
            {['Loved', 'by'].map((word) => (
              <span key={word} data-testimonials-word className={`inline-block ${hidden}`}>
                {word}
              </span>
            ))}
            <span
              data-testimonials-accent
              className={`trae-testimonials-accent trae-gradient-text inline-block ${hidden}`}
            >
              Devs
            </span>
          </span>
        </h2>
        <p
          data-testimonials-desc
          className={`mx-auto mt-4 max-w-xl text-base !text-white md:text-lg ${hidden}`}
        >
          Senix is popular among developers shipping with AI assistants and high-velocity teams.
        </p>

        {/* CodeRabbit-style featured quote bar */}
        <div className={`mx-auto mt-10 max-w-2xl rounded border border-[#32f08c]/20 bg-[#32f08c]/[0.04] px-6 py-5 text-left ${hidden}`} data-testimonials-word>
          <p className="text-sm leading-relaxed md:text-base" style={{ color: '#f5f9fe' }}>
            &ldquo;Senix caught a hardcoded API key in a Copilot-generated PR before it merged. The 30-second turnaround is genuinely impressive.&rdquo;
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#32f08c]" aria-hidden />
            <p className="text-xs font-medium text-[#a6aab5]">Senior Engineer, Series B startup</p>
          </div>
        </div>
      </div>

      <div
        data-testimonials-marquees
        className={`trae-testimonials-marquees relative mt-12 md:mt-14 ${hidden}`}
      >
        {reduced ? (
          <div className="space-y-3">
            <TestimonialMarquee items={ROW_ONE} direction="left" staticLayout />
            <TestimonialMarquee items={ROW_TWO} direction="right" staticLayout />
          </div>
        ) : (
          <>
            <TestimonialMarquee items={ROW_ONE} direction="left" />
            <TestimonialMarquee items={ROW_TWO} direction="right" className="mt-3 md:mt-4" />
          </>
        )}
      </div>
    </section>
  );
}
