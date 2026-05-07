/**
 * Dashboard skeleton shown while the page's server data fetches resolve.
 * Mirrors the real dashboard layout (header summary + analyses list + repo
 * list) so the layout doesn't shift when content streams in.
 */
export default function DashboardLoading(): React.ReactElement {
  return (
    <div className="space-y-10 animate-pulse">
      <section>
        <div className="h-8 w-40 bg-zinc-800/70 rounded-md" />
        <div className="mt-3 h-4 w-72 bg-zinc-800/40 rounded" />
      </section>

      <section>
        <div className="h-5 w-32 bg-zinc-800/60 rounded mb-4" />
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3"
            >
              <div className="h-3 w-1/3 bg-zinc-800/60 rounded" />
              <div className="h-4 w-2/3 bg-zinc-800/70 rounded" />
              <div className="h-3 w-full bg-zinc-800/40 rounded" />
              <div className="h-3 w-5/6 bg-zinc-800/40 rounded" />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="h-5 w-40 bg-zinc-800/60 rounded mb-4" />
        <ul className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div className="h-4 w-1/3 bg-zinc-800/60 rounded" />
              <div className="h-5 w-10 bg-zinc-800/70 rounded-full" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
