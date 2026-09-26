import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ACCENT_FILL } from '../../lib/accents'
import type { BoardColumnData } from '../../store/board'
import type { User } from '../../types'
import { SortableTaskCard } from './SortableTaskCard'

interface Props {
  column: BoardColumnData
  users: User[]
}

export function BoardColumn({ column, users }: Props) {
  const { status, tasks } = column

  return (
    <section
      aria-label={status.name}
      className="flex min-w-64 flex-1 flex-col rounded-panel bg-slate-100/70"
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={`size-2 shrink-0 rounded-full ${ACCENT_FILL[status.color]}`} />
        <h2 className="text-sm font-medium text-slate-700">{status.name}</h2>
        <span className="text-xs text-slate-400">{tasks.length}</span>
      </header>

      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} users={users} />
            ))
          ) : (
            <p className="rounded-card border border-dashed border-line px-3 py-6 text-center text-xs text-slate-400">
              No tasks
            </p>
          )}
        </SortableContext>
      </div>
    </section>
  )
}
