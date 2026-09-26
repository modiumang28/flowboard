import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { buildBoard } from '../../store/board'
import { useStore } from '../../store/store'
import { BoardColumn } from './BoardColumn'
import { TaskCard } from './TaskCard'

export function Board({ listId }: { listId: string }) {
  const statuses = useStore((state) => state.statuses)
  const tasks = useStore((state) => state.tasks)
  const users = useStore((state) => state.users)
  const reorderTask = useStore((state) => state.reorderTask)

  const [draggingId, setDraggingId] = useState<string | null>(null)

  const columns = useMemo(
    () => buildBoard(Object.values(statuses), Object.values(tasks), listId),
    [statuses, tasks, listId],
  )
  const userList = useMemo(() => Object.values(users), [users])

  /*
    A card is also a button that opens the drawer, so a drag must not start on
    a plain click. The distance constraint means the pointer has to travel 5px
    before dnd-kit takes over, which leaves ordinary clicks untouched.
  */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    if (!over || active.id === over.id) return

    // Reordering within a column only — moving between columns comes later.
    const column = columns.find((candidate) =>
      candidate.tasks.some((task) => task.id === active.id),
    )
    if (!column) return

    const toIndex = column.tasks.findIndex((task) => task.id === over.id)
    if (toIndex === -1) return

    reorderTask(String(active.id), toIndex)
  }

  const dragging = draggingId ? tasks[draggingId] : null

  if (columns.length === 0) {
    return (
      <p className="px-6 py-10 text-sm text-slate-500">
        This list has no statuses configured.
      </p>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={({ active }: DragStartEvent) => setDraggingId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="flex h-full gap-3 overflow-x-auto px-6 pb-6">
        {columns.map((column) => (
          <BoardColumn key={column.status.id} column={column} users={userList} />
        ))}
      </div>

      {/* The lifted card, following the cursor — the brief's "visible drag preview". */}
      <DragOverlay>
        {dragging ? (
          <div className="shadow-drag">
            <TaskCard task={dragging} users={userList} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
