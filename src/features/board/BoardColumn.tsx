import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ACCENT_FILL } from '../../lib/accents'
import type { BoardColumnData } from '../../store/board'
import type { User } from '../../types'
import { SortableTaskCard } from './SortableTaskCard'

interface Props {
  column: BoardColumnData
  users: User[]
  /*
    True while a dragged card would land here. Driven by Board rather than by
    useDroppable's own isOver, which drops to false as soon as the pointer is
    over one of the cards inside instead of the column itself.
  */
  isDropTarget: boolean
}

export function BoardColumn({ column, users, isDropTarget }: Props) {
  const { status, tasks } = column

  // Registered under the status id, so an empty column is still a valid target.
  const { setNodeRef } = useDroppable({ id: status.id })

  return (
    <section
      ref={setNodeRef}
      aria-label={status.name}
      className={`flex min-w-64 flex-1 flex-col rounded-panel transition ${
        // Inset, because the board scrolls horizontally and so clips anything
        // drawn outside a column — an outer ring loses its top edge.
        isDropTarget ? 'bg-brand/5 ring-2 ring-brand/40 ring-inset' : 'bg-slate-100/70'
      }`}
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
            <p
              className={`rounded-card border border-dashed px-3 py-6 text-center text-xs transition ${
                isDropTarget ? 'border-brand/40 text-brand' : 'border-line text-slate-400'
              }`}
            >
              {isDropTarget ? 'Drop here' : 'No tasks'}
            </p>
          )}
        </SortableContext>
      </div>
    </section>
  )
}
