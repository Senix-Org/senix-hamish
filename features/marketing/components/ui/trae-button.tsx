'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type TraeButtonVariant = 'brand' | 'outline';

type TraeButtonProps = {
  variant?: TraeButtonVariant;
  href: string;
  children: ReactNode;
  className?: string;
};

/** TRAE-style CTA button (brand green or white outline). */
export function TraeButton({
  variant = 'brand',
  href,
  children,
  className = '',
}: TraeButtonProps): React.ReactElement {
  const base =
    'trae-btn inline-flex h-10 min-w-[96px] items-center justify-center rounded-md px-6 text-sm font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500/50 xl:h-16 xl:px-7 xl:text-base';

  const variantClass =
    variant === 'brand'
      ? 'trae-btn-brand bg-[var(--trae-brand)] text-[#0a0b0d] hover:bg-[var(--trae-brand-hover)]'
      : 'trae-btn-outline border border-white text-[#f5f9fe] hover:bg-white/[0.08] hover:text-[#f5f9fe]';

  return (
    <Link href={href} className={`${base} ${variantClass} ${className}`}>
      <span className="translate-y-px">{children}</span>
    </Link>
  );
}

type TraeAuthButtonProps = {
  children: ReactNode;
  className?: string;
};

/** Wraps auth CTAs in TRAE brand button shell. */
export function TraeAuthButtonShell({
  children,
  className = '',
}: TraeAuthButtonProps): React.ReactElement {
  return (
    <div
      className={`trae-btn trae-btn-brand inline-flex h-10 min-w-[96px] items-center justify-center rounded-md px-6 text-sm font-medium tracking-wide xl:h-16 xl:px-7 xl:text-base [&_.btn-senix]:!h-full [&_.btn-senix]:!min-h-0 [&_.btn-senix]:!border-0 [&_.btn-senix]:!bg-transparent [&_.btn-senix]:!px-0 [&_.btn-senix]:!py-0 [&_.btn-senix]:!text-inherit [&_.btn-senix]:!shadow-none ${className}`}
    >
      {children}
    </div>
  );
}
