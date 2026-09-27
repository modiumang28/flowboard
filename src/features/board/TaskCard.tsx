import { CalendarDays } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { AvatarGroup } from '../../components/Avatar'
import { PriorityBadge } from '../../components/PriorityBadge'
import { formatDueDate } from '../../lib/format'
import type { Task, User } from '../../types'

/*
  Where the card is being drawn:
    - default:     on the board, reacting to hover and press
    - placeholder: the spot a dragged card left behind; holds the pressed
                   colour, since that is the state it was picked up in
    - overlay:     the lifted copy following the pointer; plain white, and it
                   must not pick up hover from the pointer sitting on top of it
*/
export type TaskCardVariant = 'default' | 'placeholder' | 'overlay'

interface Props {
  task: Task
  users: User[]
  variant?: TaskCardVariant
}

/*
  Card states, split so they never compete:
    - Background carries pointer state: hover and pressed.
    - Border is reserved for keyboard focus (focus-visible keeps it off for
      mouse clicks).
*/
const SURFACE: Record<TaskCardVariant, string> = {
  default: 'bg-white hover:bg-slate-100 active:bg-slate-200',
  placeholder: 'bg-slate-200',
  overlay: 'bg-white',
}

const KEYBOARD_FOCUS =
  'has-focus-visible:border-brand has-focus-visible:ring-1 has-focus-visible:ring-brand'

export function TaskCard({ task, users, variant = 'default' }: Props) {
  const [, setSearchParams] = useSearchParams()

  const assignees = task.assigneeIds
    .map((id) => users.find((user) => user.id === id))
    .filter((user): user is User => Boolean(user))

  const due = task.dueDate ? formatDueDate(task.dueDate) : null
  const hasFooter = task.priority !== 'none' || due !== null || assignees.length > 0

  return (
    <article
      className={`rounded-card border border-line shadow-card transition-colors ${SURFACE[variant]} ${KEYBOARD_FOCUS}`}
    >
      <button
        type="button"
        onClick={() => setSearchParams({ task: task.id })}
        className="w-full cursor-pointer p-3 text-left focus:outline-none"
      >
        <h3 className="text-sm leading-snug font-medium break-words text-slate-900">
          {task.title}
        </h3>

        {hasFooter && (
          <div className="mt-2.5 flex items-center gap-2">
            <PriorityBadge priority={task.priority} />

            {due && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] ${
                  due.isOverdue ? 'font-medium text-accent-red' : 'text-slate-500'
                }`}
              >
                <CalendarDays size={12} />
                {due.label}
              </span>
            )}

            <span className="ml-auto">
              <AvatarGroup users={assignees} />
            </span>
          </div>
        )}
      </button>
    </article>
  )
}
