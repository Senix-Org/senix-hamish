'use client';

import { AnimatedCounter } from '../animated-counter';
import { useTraeReveal } from '../../hooks/use-trae-reveal';

const INTEGRATION_ICONS: Record<string, { path: string; fill: string }> = {
  cursor: { path: 'M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23', fill: '#ffffff' },
  copilot: { path: 'M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z', fill: '#ffffff' },
  'claude code': { path: 'M21 10.5h3v3h-3v3h-1.5v3H18v-3h-1.5v3H15v-3H9v3H7.5v-3H6v3H4.5v-3H3v-3H0v-3h3v-6h18Zm-15 0h1.5v-3H6Zm10.5 0H18v-3h-1.5z', fill: '#D97757' },
  windsurf: { path: 'M23.55 5.067c-1.2038-.002-2.1806.973-2.1806 2.1765v4.8676c0 .972-.8035 1.7594-1.7597 1.7594-.568 0-1.1352-.286-1.4718-.7659l-4.9713-7.1003c-.4125-.5896-1.0837-.941-1.8103-.941-1.1334 0-2.1533.9635-2.1533 2.153v4.8957c0 .972-.7969 1.7594-1.7596 1.7594-.57 0-1.1363-.286-1.4728-.7658L.4076 5.1598C.2822 4.9798 0 5.0688 0 5.2882v4.2452c0 .2147.0656.4228.1884.599l5.4748 7.8183c.3234.462.8006.8052 1.3509.9298 1.3771.313 2.6446-.747 2.6446-2.0977v-4.893c0-.972.7875-1.7593 1.7596-1.7593h.003a1.798 1.798 0 0 1 1.4718.7658l4.9723 7.0994c.4135.5905 1.05.941 1.8093.941 1.1587 0 2.1515-.9645 2.1515-2.153v-4.8948c0-.972.7875-1.7594 1.7596-1.7594h.194a.22.22 0 0 0 .2204-.2202v-4.622a.22.22 0 0 0-.2203-.2203Z', fill: '#ffffff' },
  'vs code': { path: 'M11.583.54a1.467 1.467 0 0 0-.441 2.032c2.426 3.758 2.999 6.592 2.75 9.075-1.004 4.756-3.187 5.721-5.094 5.721-1.863 0-1.364-3.065.036-3.962.836-.522 1.906-.861 2.728-.861.814 0 1.474-.658 1.474-1.47 0-.812-.66-1.47-1.474-1.47-.96 0-1.901.202-2.78.545.18-.847.246-1.762.014-2.735-.352-1.477-1.367-2.889-3.128-4.257a1.476 1.476 0 0 0-2.069.256c-.5.64-.384 1.564.259 2.063 1.435 1.114 1.908 1.939 2.07 2.618.162.679.032 1.407-.293 2.408-.416 1.349-.9 2.553-1.11 3.708-.105.568-.114 1.187-.14 1.68-1.034-1.006-1.438-2.336-1.438-4.279 0-.811-.66-1.47-1.474-1.47-.814.001-1.473.659-1.473 1.47 0 2.654.776 5.179 2.855 6.863 1.883 1.793 6.67 1.13 6.67 4.01 0 .812 1.19 1.208 2.004 1.208.834 0 1.885-.558 1.885-1.208 0-3.267 3.443-5.253 9.11-5.244A1.472 1.472 0 0 0 24 15.773 1.472 1.472 0 0 0 22.53 14.3c-.388 0-.765.013-1.138.035.634-1.49.915-3.13.857-4.903a1.473 1.473 0 0 0-1.522-1.42 1.472 1.472 0 0 0-1.425 1.517c.076 2.32-.01 4.393-1.74 5.485-.49.31-1.062.58-1.604.58.42-1.145.738-2.353.869-3.655.083-.83.091-1.818-.003-2.585-.148-1.188-.325-2.535.126-3.55.405-.874 1.313-1.24 2.645-1.24.814 0 1.473-.659 1.473-1.47 0-.811-.659-1.47-1.473-1.47-1.98 0-3.481 1.042-4.332 2.3-.445-.95-.987-1.929-1.642-2.943a1.474 1.474 0 0 0-2.037-.44z', fill: '#4fc3f7' },
};

const STATS = [
  { value: 30, suffix: 's', label: 'average time to review', prefix: '' },
  { value: 4, suffix: '', label: 'AI providers, always on', prefix: '' },
  { value: 0.01, suffix: '', label: 'average cost per review', prefix: '$', decimals: 2 },
  { value: 99, suffix: '%', label: 'webhook uptime', prefix: '' },
];

const INTEGRATIONS = ['Cursor', 'Copilot', 'Claude Code', 'Windsurf', 'VS Code'];

/**
 * CodeRabbit-style bold "leader" stats band with large numbers and integration pills.
 */
export function TraeStatsSection(): React.ReactElement {
  const ref = useTraeReveal<HTMLElement>({ childSelector: '[data-trae-item]', stagger: 0.07 });

  return (
    <section ref={ref} className="relative overflow-hidden border-y border-white/[0.08]">
      {/* CodeRabbit-style top gradient glow for the section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-full"
        style={{
          background:
            'radial-gradient(ellipse 70% 80% at 50% 0%, rgba(50, 240, 140,0.07) 0%, transparent 65%)',
        }}
      />

      <div className="trae-section relative py-16 md:py-20">
        {/* Header label */}
        <div data-trae-item className="opacity-0 text-center mb-12 md:mb-16">
          <p className="trae-section-label">By the numbers</p>
          <p className="mt-3 text-[#ffffff] text-lg font-medium">
            The fastest AI code review for teams shipping with AI assistants.
          </p>
        </div>

        {/* CodeRabbit-style stat grid with border separators */}
        <div
          data-trae-item
          className="opacity-0 grid grid-cols-2 gap-px lg:grid-cols-4"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '4px',
          }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center sm:px-6 sm:py-10"
              style={{ background: 'var(--trae-bg)' }}
            >
              <div className="trae-gradient-text trae-leader-stat-number tabular-nums">
                {stat.prefix}
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  decimals={stat.decimals ?? 0}
                  duration={1.4}
                />
              </div>
              <p className="text-sm text-[#8b8794]">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Glow separator */}
        <div data-trae-item className="trae-glow-separator my-12 md:my-14 opacity-0" />

        {/* Integrations row */}
        <div data-trae-item className="opacity-0">
          <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:text-left lg:gap-10">
            <div className="lg:w-64 shrink-0">
              <p className="text-sm font-medium text-[#ffffff]">Works where you ship</p>
              <p className="mt-2 text-sm text-[#c9c5d2]">
                Connect GitHub once. Get reviews in the PR, in Cursor via MCP, or from any IDE.
              </p>
            </div>

            <div className="flex flex-1 flex-wrap justify-center gap-2 lg:justify-start">
              {INTEGRATIONS.map((name) => {
                const icon = INTEGRATION_ICONS[name.toLowerCase()];
                return (
                  <span
                    key={name}
                    className="trae-card-gradient-border inline-flex items-center gap-2 rounded border border-white/[0.10] bg-[#0d0e10] px-5 py-2.5 text-sm text-[#c9c5d2] transition hover:border-[#32f08c]/30 hover:text-[#ffffff]"
                  >
                    {icon && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={15} height={15} fill={icon.fill} className="shrink-0 opacity-80" aria-hidden="true">
                        <path d={icon.path} />
                      </svg>
                    )}
                    {name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
