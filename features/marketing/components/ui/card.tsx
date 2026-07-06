import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type MarketingCardProps = {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  as?: 'div' | 'article';
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>;

/**
 * Dark card shell with hairline border and optional green highlight glow.
 */
export function MarketingCard({
  children,
  className = '',
  highlight = false,
  as: Tag = 'div',
  ...rest
}: MarketingCardProps): React.ReactElement {
  return (
    <Tag
      {...rest}
      className={[
        'marketing-card rounded-[10px] border bg-zinc-950/40 p-6 transition-all duration-300',
        highlight
          ? 'border-green-500/40 shadow-[0_0_40px_-12px_rgba(34,197,94,0.35)]'
          : 'border-white/[0.08] hover:border-white/[0.12]',
        'hover:-translate-y-1',
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  );
}
