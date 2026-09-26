import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, User } from '../../types'
import { TaskCard } from './TaskCard'

/*
  Keeps the drag wiring out of TaskCard, so the plain card can also be rendered
  inside the DragOverlay.

  STYLING EXCEPTION: dnd-kit computes the drag transform at runtime, so it has
  to be applied as an inline style — a Tailwind class cannot express a value
  that only exists mid-gesture. The brief allows this specifically ("tiny
  exceptions for DnD library-required transforms are OK"). It is the only
  inline style in the project, and it sets transform/transition only, never
  layout or theming.
*/
export function SortableTaskCard({ task, users }: { task: Task; users: User[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // dnd-kit defaults this wrapper to role="button", which would nest a
      // button inside a button once the card's own open-drawer button renders.
      // It stays keyboard-draggable — the sensor listens for keys, not a role.
      role="group"
      // The lifted card is shown in the DragOverlay instead, so leave a faint
      // placeholder in the gap it came from.
      className={`touch-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <TaskCard task={task} users={users} />
    </div>
  )
}
