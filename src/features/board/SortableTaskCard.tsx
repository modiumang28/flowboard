import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, User } from '../../types'
import { TaskCard } from './TaskCard'

/*
  Keeps the drag wiring out of TaskCard, so the plain card can also be rendered
  inside the DragOverlay.

  Dragging is pointer-only, so dnd-kit's `attributes` (a tab stop plus
  keyboard-drag instructions for screen readers) are deliberately not spread:
  they would announce a gesture that does nothing. The card's own button stays
  the single tab stop.

  STYLING EXCEPTION: dnd-kit computes the drag transform at runtime, so it has
  to be applied as an inline style — a Tailwind class cannot express a value
  that only exists mid-gesture. The brief allows this specifically ("tiny
  exceptions for DnD library-required transforms are OK"). It is the only
  inline style in the project, and it sets transform/transition only, never
  layout or theming.
*/
export function SortableTaskCard({ task, users }: { task: Task; users: User[] }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
      // The lifted card is shown in the DragOverlay instead; what stays behind
      // is a faded placeholder in the pressed colour, marking where it came from.
      className={`touch-none ${isDragging ? 'opacity-50' : ''}`}
    >
      <TaskCard
        task={task}
        users={users}
        variant={isDragging ? 'placeholder' : 'default'}
      />
    </div>
  )
}
