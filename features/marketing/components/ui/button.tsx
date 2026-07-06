'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type BaseProps = {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
};

type ButtonAsLink = BaseProps & {
  href: string;
  onClick?: never;
  type?: never;
};

type ButtonAsButton = BaseProps & {
  href?: never;
  onClick?: () => void;
  type?: 'button' | 'submit';
};

type MarketingButtonProps = ButtonAsLink | ButtonAsButton;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-senix btn-senix-primary marketing-btn',
  secondary: 'btn-senix btn-senix-secondary marketing-btn',
  ghost: 'btn-senix btn-senix-ghost marketing-btn',
};

/**
 * Marketing button with hover scale/glow micro-interaction.
 */
export function MarketingButton(props: MarketingButtonProps): React.ReactElement {
  const { variant = 'primary', children, className = '' } = props;
  const classes = `${VARIANT_CLASS[variant]} ${className}`.trim();

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={props.type ?? 'button'} onClick={props.onClick} className={classes}>
      {children}
    </button>
  );
}
