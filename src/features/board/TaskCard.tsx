import { CalendarDays } from 'lucide-react'
import { AvatarGroup } from '../../components/Avatar'
import { PriorityBadge } from '../../components/PriorityBadge'
import { formatDueDate } from '../../lib/format'
import type { Task, User } from '../../types'

interface Props {
  task: Task
  users: User[]
}

export function TaskCard({ task, users }: Props) {
  const assignees = task.assigneeIds
    .map((id) => users.find((user) => user.id === id))
    .filter((user): user is User => Boolean(user))

  const due = task.dueDate ? formatDueDate(task.dueDate) : null
  const hasFooter = task.priority !== 'none' || due !== null || assignees.length > 0

  return (
    <article className="cursor-pointer rounded-card border border-line bg-white p-3 shadow-card transition hover:border-slate-300 hover:shadow-pop">
      <h3 className="text-sm leading-snug font-medium text-slate-900">{task.title}</h3>

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
    </article>
  )
}
