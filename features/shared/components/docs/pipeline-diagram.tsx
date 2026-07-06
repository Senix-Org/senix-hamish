import { ArrowRight } from 'lucide-react';

const STEPS = [
  { label: 'Webhook', detail: 'PR opened or updated' },
  { label: 'Diff', detail: 'Fetch changed files' },
  { label: 'Parse', detail: 'tree-sitter symbols' },
  { label: 'Analyze', detail: 'LLM behavioral read' },
  { label: 'Comment', detail: 'Posted on PR' },
] as const;

/**
 * Horizontal pipeline visualization for the how-it-works docs page.
 * Collapses to a vertical stack on narrow viewports.
 */
export function PipelineDiagram(): React.ReactElement {
  return (
    <div className="mt-6 rounded-xl border border-surface-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex flex-1 items-center gap-2 sm:flex-col sm:gap-3">
            <div className="flex flex-1 flex-col rounded-lg border border-surface-border bg-surface-raised px-4 py-3 sm:w-full sm:text-center">
              <span className="font-mono text-xs uppercase tracking-wider text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="mt-1 text-sm font-semibold text-primary">{step.label}</span>
              <span className="mt-0.5 text-xs text-muted">{step.detail}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight
                size={16}
                className="shrink-0 text-muted sm:rotate-0 max-sm:rotate-90"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
