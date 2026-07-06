import Link from 'next/link';
import { TraeFooterWordmark } from './footer-wordmark';

const COLUMNS = [
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

/** TRAE-style dense footer with Senix links. */
export function TraeFooterSection(): React.ReactElement {
  return (
    <footer className="border-t border-white/[0.08] bg-[#0a0b0d]">
      <div className="trae-section py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6 md:gap-10">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="" className="h-7 w-7 rounded ring-1 ring-white/[0.1]" />
              <span className="font-mono text-sm text-[#f5f9fe]">senix</span>
            </Link>
            <p className="mt-4 max-w-[18rem] text-xs leading-relaxed text-[#787d87]">
              AI code review for every pull request. Behavioral summaries, risk tags, and focus
              files within 30 seconds.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#787d87]">
                {col.heading}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-[#a6aab5] transition hover:text-[#f5f9fe]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="trae-divider mt-10" />

        <div className="mt-6 flex flex-col gap-2 text-xs text-[#787d87] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Senix</span>
          <span className="font-mono text-[11px]">Built with care · DeepSeek · Tree-sitter</span>
        </div>
      </div>

      <TraeFooterWordmark />
    </footer>
  );
}
