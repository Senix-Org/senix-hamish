/**
 * Reviews route loading skeleton. Shown while the server component fetches
 * the analyses list. Mirrors the header plus a stack of card placeholders
 * so the layout does not jump when real content arrives.
 */
export default function ReviewsLoading(): React.ReactElement {
  return (
    <div>
      <header>
        <h1 className="text-3xl font-semibold text-primary">Reviews</h1>
        <p className="mt-2 text-sm text-secondary">
          Every review Senix has posted, newest first.
        </p>
      </header>

      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-surface-border bg-surface p-6"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-40 rounded bg-surface-raised" />
              <div className="h-5 w-16 rounded-full bg-surface-raised" />
            </div>
            <div className="mt-3 h-4 w-2/3 rounded bg-surface-raised" />
            <div className="mt-3 h-3 w-full rounded bg-surface-raised" />
            <div className="mt-2 h-3 w-5/6 rounded bg-surface-raised" />
            <div className="mt-4 h-3 w-24 rounded bg-surface-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
