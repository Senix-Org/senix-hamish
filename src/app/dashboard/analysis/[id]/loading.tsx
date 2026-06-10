/**
 * Analysis detail skeleton. Mirrors the breadcrumb, header card, summary
 * card, and structural-diff rows so the layout holds while the row loads.
 */
export default function AnalysisLoading(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-40 rounded bg-surface-raised/60" />

      <div className="rounded-xl border border-surface-border bg-surface p-6">
        <div className="h-3.5 w-48 rounded bg-surface-raised/60" />
        <div className="mt-3 h-6 w-2/3 rounded bg-surface-raised" />
        <div className="mt-5 flex gap-2 border-t border-surface-border pt-4">
          <div className="h-6 w-24 rounded-full bg-surface-raised" />
          <div className="h-6 w-20 rounded-full bg-surface-raised/70" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-surface-border bg-surface p-6">
        <div className="h-4 w-40 rounded bg-surface-raised" />
        <div className="h-3 w-full rounded bg-surface-raised/50" />
        <div className="h-3 w-11/12 rounded bg-surface-raised/50" />
        <div className="h-3 w-4/5 rounded bg-surface-raised/50" />
      </div>

      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 rounded-xl border border-surface-border bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
