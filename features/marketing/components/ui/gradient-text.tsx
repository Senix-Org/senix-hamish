import type { ReactNode } from 'react';

type GradientTextProps = {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3';
};

/** Green gradient text for accent headlines. */
export function GradientText({
  children,
  className = '',
  as: Tag = 'span',
}: GradientTextProps): React.ReactElement {
  return (
    <Tag
      className={`bg-gradient-to-r from-green-400 via-green-500 to-emerald-400 bg-clip-text text-transparent ${className}`}
    >
      {children}
    </Tag>
  );
}
