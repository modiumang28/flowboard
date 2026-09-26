import { CalendarDays } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { AvatarGroup } from '../../components/Avatar'
import { PriorityBadge } from '../../components/PriorityBadge'
import { formatDueDate } from '../../lib/format'
import type { Task, User } from '../../types'

interface Props {
  task: Task
  users: User[]
}

export function TaskCard({ task, users }: Props) {
  const [, setSearchParams] = useSearchParams()
  const assignees = task.assigneeIds
    .map((id) => users.find((user) => user.id === id))
    .filter((user): user is User => Boolean(user))

  const due = task.dueDate ? formatDueDate(task.dueDate) : null
  const hasFooter = task.priority !== 'none' || due !== null || assignees.length > 0

  return (
    <article className="rounded-card border border-line bg-white shadow-card transition focus-within:border-brand hover:border-slate-300 hover:shadow-pop">
      <button
        type="button"
        onClick={() => setSearchParams({ task: task.id })}
        className="w-full cursor-pointer p-3 text-left focus:outline-none"
      >
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
      </button>
    </article>
  )
}
