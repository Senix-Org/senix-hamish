/**
 * Billing route skeleton. Mirrors the current-plan card, the row of usage
 * stat cards, and the plan-comparison grid so the layout holds while the
 * plan and usage data load.
 */
export default function BillingLoading(): React.ReactElement {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-md bg-surface-raised" />
      <div className="mt-2 h-4 w-72 max-w-full rounded bg-surface-raised/60" />

      {/* Current plan card */}
      <div className="mt-8 rounded-xl border border-surface-border bg-surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded bg-surface-raised/60" />
            <div className="h-7 w-40 rounded bg-surface-raised" />
            <div className="h-3 w-56 rounded bg-surface-raised/50" />
          </div>
          <div className="h-10 w-40 rounded-lg bg-surface-raised" />
        </div>
        <div className="mt-5 h-2 w-full rounded-full bg-surface-raised/60" />
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-surface-border bg-surface p-5">
            <div className="h-3 w-28 rounded bg-surface-raised/60" />
            <div className="mt-3 h-7 w-20 rounded bg-surface-raised" />
            <div className="mt-2 h-3 w-24 rounded bg-surface-raised/50" />
          </div>
        ))}
      </div>

      {/* Plan comparison grid */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-xl border border-surface-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
