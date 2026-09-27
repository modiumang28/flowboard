/*
  Placeholders shown while the store is still reading from its adapter.

  They mirror the shape of what replaces them — a tree of indented rows, a row
  of columns holding cards — so the layout does not jump when the real content
  arrives. A centred spinner would be less work and worse: it tells you to
  wait without telling you what for.

  Marked aria-hidden and paired with a live region on the container, so a
  screen reader hears "Loading" once rather than reading out a dozen empty
  boxes.
*/

function Bar({ className = '' }: { className?: string }) {
  return <span className={`block h-3 animate-pulse rounded bg-slate-200 ${className}`} />
}

export function SidebarSkeleton() {
  // Roughly the shape of a workspace with two spaces and a few lists.
  const rows = ['w-28', 'w-24 ml-3', 'w-20 ml-6', 'w-24 ml-6', 'w-20 ml-3', 'w-28 ml-6']

  return (
    <div aria-hidden className="flex flex-col gap-3 p-3">
      {rows.map((width, index) => (
        <Bar key={index} className={width} />
      ))}
    </div>
  )
}

export function BoardSkeleton() {
  const columns = [3, 2, 1]

  return (
    <div aria-hidden className="flex h-full gap-3 overflow-hidden px-6 pb-6">
      {columns.map((cards, column) => (
        <section
          key={column}
          className="flex min-w-64 flex-1 flex-col rounded-panel bg-slate-100/70"
        >
          <header className="flex items-center gap-2 px-3 py-2.5">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-slate-300" />
            <Bar className="w-20" />
          </header>

          <div className="flex flex-col gap-2 px-2 pb-2">
            {Array.from({ length: cards }, (_, card) => (
              <div
                key={card}
                className="flex flex-col gap-2.5 rounded-card border border-line bg-white p-3"
              >
                <Bar className="w-full" />
                <div className="flex items-center gap-2">
                  <Bar className="h-4 w-12 rounded" />
                  <Bar className="ml-auto size-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 px-6 pb-6">
      {Array.from({ length: 5 }, (_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 rounded-card bg-white px-3 py-3"
        >
          <Bar className="w-64" />
          <Bar className="w-20" />
          <Bar className="ml-auto size-6 rounded-full" />
          <Bar className="h-4 w-14 rounded" />
          <Bar className="w-16" />
        </div>
      ))}
    </div>
  )
}
