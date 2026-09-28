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
import { buildBoard, resolveBoardDrop } from '../../store/board'
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
  /*
    Where the card would land, tracked during the drag. Within a column the
    sorting strategy already opens a gap, but a card dragged in from another
    column is not part of that column's SortableContext, so nothing shifts —
    the target column knows nothing is coming. This drives an insertion line
    so a cross-column drop says where, not just which column.
  */
  const [dropTarget, setDropTarget] = useState<{
    statusId: string
    index: number
  } | null>(null)

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

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    setDropTarget(null)
    if (!over) return

    const taskId = String(active.id)
    const drop = resolveBoardDrop(columns, taskId, String(over.id))
    if (!drop) return

    /*
      A drop has nowhere to show an inline error once the pointer is released,
      so failures go to a toast. Nothing can fail here yet — the board only
      ever passes ids it just rendered — but the store's contract is that every
      mutation returns a Result, and this is the one place that was discarding
      one. It becomes reachable as soon as a permission check or a real backend
      can say no.
    */
    if (drop.sameColumn) {
      if (active.id === over.id) return
      notifyOnError(reorderTask(taskId, drop.index))
    } else {
      // Across columns, the gesture means "change status".
      notifyOnError(moveTaskToStatus(taskId, drop.statusId, drop.index))
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
      onDragOver={({ active, over }: DragOverEvent) => {
        const drop = over
          ? resolveBoardDrop(columns, String(active.id), String(over.id))
          : null
        if (!drop) return setDropTarget(null)

        /*
          Within the source column the sorting strategy already opens a real
          gap, so a placeholder there would double up. Only a card arriving
          from elsewhere needs one — hence index -1 to suppress it.
        */
        setDropTarget({
          statusId: drop.statusId,
          index: drop.sameColumn ? -1 : drop.index,
        })
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingId(null)
        setDropTarget(null)
      }}
    >
      <div className="flex h-full gap-3 overflow-x-auto px-6 pb-6">
        {columns.map((column) => (
          <BoardColumn
            key={column.status.id}
            column={column}
            users={userList}
            isDropTarget={
              draggingId !== null && dropTarget?.statusId === column.status.id
            }
            insertAt={dropTarget?.statusId === column.status.id ? dropTarget.index : -1}
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
