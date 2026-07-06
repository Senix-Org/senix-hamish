type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
};

/** Reusable section header with mono eyebrow and optional description. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className = '',
}: SectionHeadingProps): React.ReactElement {
  const alignClass = align === 'center' ? 'text-center mx-auto' : 'text-left';

  return (
    <div className={`max-w-2xl ${alignClass} ${className}`}>
      <span className="text-xs font-mono uppercase tracking-[0.2em] text-green-500/80">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-zinc-400 leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
