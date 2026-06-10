/**
 * Tokens route skeleton. Mirrors the header and a stack of token-row
 * placeholders so the layout does not jump when the list resolves.
 */
export default function TokensLoading(): React.ReactElement {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-56 rounded-md bg-surface-raised" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-surface-raised/60" />

      <div className="mt-8 flex justify-end">
        <div className="h-9 w-36 rounded-lg bg-surface-raised" />
      </div>
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-surface-border bg-surface p-5"
          >
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-surface-raised" />
              <div className="h-3 w-56 rounded bg-surface-raised/50" />
            </div>
            <div className="h-7 w-16 rounded-lg bg-surface-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
