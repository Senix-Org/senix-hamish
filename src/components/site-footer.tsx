import Link from 'next/link';

type FooterLink = {
  label: string;
  href?: string;
  disabled?: boolean;
};

type FooterColumn = {
  heading: string;
  links: FooterLink[];
};

const COLUMNS: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Product', href: '/#product' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Docs', href: '/docs' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', disabled: true },
      { label: 'Blog', disabled: true },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'GitHub', disabled: true },
      { label: 'Status', disabled: true },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', disabled: true },
      { label: 'Terms', disabled: true },
    ],
  },
];

/**
 * Shared site footer. Disabled placeholder links render as muted spans so
 * the visual weight is correct without 404s for testers.
 */
export function SiteFooter(): React.ReactElement {
  return (
    <footer className="border-t border-zinc-800/60 mt-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="" className="h-7 w-7 rounded-md ring-1 ring-zinc-800" />
              <span className="font-mono text-sm text-zinc-100">senix</span>
            </Link>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-[16rem]">
              Behavioral PR review for teams shipping with AI.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-4">
                {col.heading}
              </div>
              <ul className="space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.disabled || !l.href ? (
                      <span className="text-zinc-600 cursor-not-allowed">{l.label}</span>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-zinc-400 hover:text-zinc-100 transition-colors"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-zinc-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500">
          <span>© 2026 Senix</span>
          <span>Built with care · Claude · DeepSeek · Tree-sitter</span>
        </div>
      </div>
    </footer>
  );
}
