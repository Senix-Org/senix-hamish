'use client';

import { useEffect, useState } from 'react';

/**
 * Sticky top header shell that stays transparent at the very top of the
 * page and fades in a subtle backdrop blur plus a hairline border once the
 * user scrolls. Keeps the marketing nav unobtrusive over the hero while
 * staying legible over content further down.
 */
export function StickyHeader({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'trae';
}): React.ReactElement {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (variant === 'trae') {
    return (
      <header
        className={`trae-nav-shell sticky top-0 z-40 border-b transition-colors duration-200 ${
          scrolled ? 'border-white/[0.08] bg-[#09080c]/90 backdrop-blur-md' : 'border-transparent'
        }`}
      >
        {children}
      </header>
    );
  }

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-all duration-300 ${
        scrolled
          ? 'border-white/[0.08] bg-[#0A0A0B]/75 backdrop-blur-xl backdrop-saturate-150'
          : 'border-transparent bg-transparent'
      }`}
    >
      {children}
    </header>
  );
}
