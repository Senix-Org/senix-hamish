'use client';

import { useEffect, useState } from 'react';

export type DocSection = {
  id: string;
  label: string;
};

/**
 * Sticky table-of-contents for the docs page. Uses IntersectionObserver
 * to highlight the section currently visible in the viewport.
 */
export function DocsSidebar({ sections }: { sections: DocSection[] }): React.ReactElement {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="flex md:flex-col gap-x-5 gap-y-2 text-sm scroll-smooth">
      {sections.map((s) => {
        const isActive = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`transition-colors ${
              isActive ? 'text-green-400' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}
