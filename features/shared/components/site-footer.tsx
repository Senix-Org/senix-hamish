import Link from 'next/link';

type FooterLink = {
  label: string;
  href: string;
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
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Playground', href: '/playground' },
    ],
  },
  {
    heading: 'Developers',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'MCP setup', href: '/docs/mcp' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

/**
 * Dense marketing footer with four link columns and brand mark.
 */
export function SiteFooter(): React.ReactElement {
  return (
    <footer className="mt-8 border-t border-white/[0.08] bg-[#0A0A0B]">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6 md:gap-10">
          <div className="col-span-2">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <img src="/logo.png" alt="" className="h-7 w-7 rounded-[8px] ring-1 ring-white/[0.08]" />
              <span className="font-mono text-sm text-zinc-100">senix</span>
            </Link>
            <p className="max-w-[18rem] text-xs leading-relaxed text-zinc-500">
              AI code review for every pull request. Behavioral summaries, risk tags, and focus
              files within 30 seconds.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {col.heading}
              </div>
              <ul className="space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-zinc-400 transition hover:text-zinc-100 focus-visible:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B] rounded-sm"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Senix</span>
          <span className="font-mono text-[11px] text-zinc-600">
            Built with care · DeepSeek · Tree-sitter
          </span>
        </div>
      </div>
    </footer>
  );
}
