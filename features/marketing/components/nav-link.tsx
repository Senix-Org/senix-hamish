'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Nav link with animated underline on hover/focus.
 */
export function NavLink({ href, children, className = '' }: NavLinkProps): React.ReactElement {
  const pathname = usePathname();
  const isHash = href.startsWith('/#');
  const isActive =
    !isHash && (pathname === href || (href !== '/' && pathname.startsWith(href)));

  return (
    <Link
      href={href}
      className={`nav-link group relative py-1 text-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:text-zinc-100 ${isActive ? 'text-zinc-100' : ''} ${className}`}
    >
      {children}
      <span
        aria-hidden
        className={`nav-link-underline absolute bottom-0 left-0 h-px bg-[#32f08c] transition-all duration-300 ease-out ${
          isActive ? 'w-full opacity-100' : 'w-0 opacity-0 group-hover:w-full group-hover:opacity-100 group-focus-visible:w-full group-focus-visible:opacity-100'
        }`}
      />
    </Link>
  );
}
