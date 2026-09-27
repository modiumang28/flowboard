import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AvatarGroup } from '../../components/Avatar'
import { PriorityBadge } from '../../components/PriorityBadge'
import { ACCENT_FILL } from '../../lib/accents'
import { formatDueDate } from '../../lib/format'
import {
  buildTaskList,
  type Sort,
  type SortDirection,
  type SortKey,
} from '../../store/list'
import { useStore } from '../../store/store'
import type { User } from '../../types'

/* Sort state lives in the URL, like the open list and the open task. */
function useSort(): [Sort | undefined, (key: SortKey) => void] {
  const [params, setParams] = useSearchParams()
  const key = params.get('sort') as SortKey | null
  const direction: SortDirection = params.get('dir') === 'desc' ? 'desc' : 'asc'
  const sort = key === 'due' || key === 'priority' ? { key, direction } : undefined

  const toggle = (next: SortKey) => {
    const params2 = new URLSearchParams(params)
    if (sort?.key === next && sort.direction === 'asc') {
      params2.set('sort', next)
      params2.set('dir', 'desc')
    } else if (sort?.key === next) {
      // Third click clears the sort and returns to board order.
      params2.delete('sort')
      params2.delete('dir')
    } else {
      params2.set('sort', next)
      params2.set('dir', 'asc')
    }
    setParams(params2)
  }

  return [sort, toggle]
}

function SortHeader({
  label,
  column,
  sort,
  onToggle,
}: {
  label: string
  column: SortKey
  sort: Sort | undefined
  onToggle: (key: SortKey) => void
}) {
  const active = sort?.key === column
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <th scope="col" className="p-0 font-medium">
      <button
        type="button"
        onClick={() => onToggle(column)}
        aria-label={`Sort by ${label}`}
        className={`flex w-full cursor-pointer items-center gap-1 px-3 py-2 text-left transition hover:text-slate-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
          active ? 'text-slate-900' : 'text-slate-500'
        }`}
      >
        {label}
        <Icon size={12} className={active ? 'text-brand' : 'text-slate-300'} />
      </button>
    </th>
  )
}

/*
  The rounded corners belong to the list as a whole, not to each row — so only
  the first row's top corners and the last row's bottom corners are curved, and
  a hovered row in the middle stays square. group-first/last on the row is what
  lets a cell know where it sits.
*/
const CELL = 'border-t border-line group-last/row:border-b'
const FIRST_CELL =
  'border-l border-line group-first/row:rounded-tl-card group-last/row:rounded-bl-card'
const LAST_CELL =
  'border-r border-line group-first/row:rounded-tr-card group-last/row:rounded-br-card'

export function TaskTable({ listId }: { listId: string }) {
  const statuses = useStore((state) => state.statuses)
  const tasks = useStore((state) => state.tasks)
  const users = useStore((state) => state.users)
  const [, setParams] = useSearchParams()
  const [sort, toggleSort] = useSort()

  const rows = useMemo(
    () => buildTaskList(Object.values(statuses), Object.values(tasks), listId, sort),
    [statuses, tasks, listId, sort],
  )

  const openTask = (taskId: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('task', taskId)
      return next
    })

  if (rows.length === 0) {
    return (
      <div className="px-6">
        <p className="rounded-panel border border-dashed border-line py-12 text-center text-sm text-slate-400">
          This list has no tasks yet.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto px-6 pb-6">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 bg-page">
          <tr className="text-xs">
            {/* 360px: wide enough for most titles, narrow enough that the other
                columns keep their share. */}
            <th
              scope="col"
              className="w-90 px-3 py-2 text-left font-medium text-slate-500"
            >
              Task
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-slate-500">
              Status
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-slate-500">
              Assignees
            </th>
            <SortHeader
              label="Priority"
              column="priority"
              sort={sort}
              onToggle={toggleSort}
            />
            <SortHeader label="Due" column="due" sort={sort} onToggle={toggleSort} />
          </tr>
        </thead>

        <tbody>
          {rows.map(({ task, status }) => {
            const assignees = task.assigneeIds
              .map((id) => users[id])
              .filter((user): user is User => Boolean(user))
            const due = task.dueDate ? formatDueDate(task.dueDate) : null

            return (
              <tr
                key={task.id}
                onClick={() => openTask(task.id)}
                className="group/row cursor-pointer bg-white transition hover:bg-brand/5"
              >
                <td className={`max-w-0 px-3 py-2.5 ${CELL} ${FIRST_CELL}`}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      openTask(task.id)
                    }}
                    className="block w-full cursor-pointer truncate text-left font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                  >
                    {task.title}
                  </button>
                </td>

                <td className={`px-3 py-2.5 whitespace-nowrap ${CELL}`}>
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span
                      className={`size-2 shrink-0 rounded-full ${ACCENT_FILL[status.color]}`}
                    />
                    {status.name}
                  </span>
                </td>

                <td className={`px-3 py-2.5 ${CELL}`}>
                  {assignees.length > 0 ? (
                    <AvatarGroup users={assignees} />
                  ) : (
                    <span className="text-xs text-slate-400">Unassigned</span>
                  )}
                </td>

                <td className={`px-3 py-2.5 ${CELL}`}>
                  {task.priority === 'none' ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : (
                    <PriorityBadge priority={task.priority} />
                  )}
                </td>

                <td className={`px-3 py-2.5 whitespace-nowrap ${CELL} ${LAST_CELL}`}>
                  {due ? (
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${
                        due.isOverdue ? 'font-medium text-accent-red' : 'text-slate-500'
                      }`}
                    >
                      <CalendarDays size={12} />
                      {due.label}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
