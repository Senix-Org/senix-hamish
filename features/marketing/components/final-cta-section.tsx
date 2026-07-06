'use client';

import SignInButton from '@features/shared/components/sign-in-button';
import { GradientText } from './ui/gradient-text';
import { useGsapScrollReveal } from '../hooks/use-gsap-scroll-reveal';

/**
 * Final CTA panel with green radial glow motif.
 */
export function FinalCtaSection(): React.ReactElement {
  const ref = useGsapScrollReveal<HTMLElement>({ y: 24 });

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 h-[500px] w-[700px] -translate-x-1/2 bg-glow-green opacity-90"
      />

      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-6">
        <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Stop reading every line.
          <br />
          <GradientText>Read every risk.</GradientText>
        </h2>
        <p className="mt-6 leading-relaxed text-zinc-400">
          Two minutes from install to your first review.
        </p>
        <SignInButton label="Get started free" variant="hero" className="mt-9 px-6" />
      </div>
    </section>
  );
}
