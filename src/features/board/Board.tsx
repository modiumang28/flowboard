import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { buildBoard, type BoardColumnData } from '../../store/board'
import { BoardSkeleton } from '../../components/Skeleton'
import { useStore } from '../../store/store'
import { notifyOnError } from '../../store/toasts'
import { BoardColumn } from './BoardColumn'
import { TaskCard } from './TaskCard'

export function Board({ listId }: { listId: string }) {
  const isReady = useStore((state) => state.isReady)
  const statuses = useStore((state) => state.statuses)
  const tasks = useStore((state) => state.tasks)
  const users = useStore((state) => state.users)
  const reorderTask = useStore((state) => state.reorderTask)
  const moveTaskToStatus = useStore((state) => state.moveTaskToStatus)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStatusId, setOverStatusId] = useState<string | null>(null)

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
  )

  /*
    A drop target is either a column (dropped on empty space, id = status id)
    or a card (dropped between cards, id = task id). Resolve both to the column
    that would receive the task, and the index it would land at.
  */
  const resolveDrop = (
    overId: string,
  ): { column: BoardColumnData; index: number } | null => {
    const asColumn = columns.find((column) => column.status.id === overId)
    if (asColumn) return { column: asColumn, index: asColumn.tasks.length }

    const asCard = columns.find((column) =>
      column.tasks.some((task) => task.id === overId),
    )
    if (!asCard) return null
    return { column: asCard, index: asCard.tasks.findIndex((t) => t.id === overId) }
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    setOverStatusId(null)
    if (!over) return

    const taskId = String(active.id)
    const target = resolveDrop(String(over.id))
    const source = columns.find((column) =>
      column.tasks.some((task) => task.id === taskId),
    )
    if (!target || !source) return

    /*
      A drop has nowhere to show an inline error once the pointer is released,
      so failures go to a toast. Nothing can fail here yet — the board only
      ever passes ids it just rendered — but the store's contract is that every
      mutation returns a Result, and this is the one place that was discarding
      one. It becomes reachable as soon as a permission check or a real backend
      can say no.
    */
    if (source.status.id === target.column.status.id) {
      if (active.id === over.id) return
      notifyOnError(reorderTask(taskId, target.index))
    } else {
      // Across columns, the gesture means "change status".
      notifyOnError(moveTaskToStatus(taskId, target.column.status.id, target.index))
    }
  }

  const dragging = draggingId ? tasks[draggingId] : null

  if (!isReady) {
    return (
      <div aria-busy aria-live="polite" className="h-full">
        <span className="sr-only">Loading board</span>
        <BoardSkeleton />
      </div>
    )
  }

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
      /*
        pointerWithin beats closestCenter here: with tall columns, closestCenter
        keeps resolving to whichever card is nearest rather than the empty
        column the pointer is actually inside.
      */
      collisionDetection={pointerWithin}
      onDragStart={({ active }: DragStartEvent) => setDraggingId(String(active.id))}
      onDragOver={({ over }: DragOverEvent) =>
        setOverStatusId(
          over ? (resolveDrop(String(over.id))?.column.status.id ?? null) : null,
        )
      }
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingId(null)
        setOverStatusId(null)
      }}
    >
      <div className="flex h-full gap-3 overflow-x-auto px-6 pb-6">
        {columns.map((column) => (
          <BoardColumn
            key={column.status.id}
            column={column}
            users={userList}
            isDropTarget={draggingId !== null && overStatusId === column.status.id}
          />
        ))}
      </div>

      {/* The lifted card, following the cursor — the brief's "visible drag preview". */}
      <DragOverlay>
        {dragging ? (
          <div className="shadow-drag">
            <TaskCard task={dragging} users={userList} variant="overlay" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
