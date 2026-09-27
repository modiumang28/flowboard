import { PRIORITY_RANK, type Status, type Task } from '../types'

/*
  The list view's data, kept as a pure function like buildTree and buildBoard.

  It returns each task already paired with its status so the table does not
  have to look them up row by row.
*/

export type SortKey = 'priority' | 'due'
export type SortDirection = 'asc' | 'desc'

export interface TaskRow {
  task: Task
  status: Status
}

export interface Sort {
  key: SortKey
  direction: SortDirection
}

/*
  Undated tasks always sort last, in both directions. Treating "no due date"
  as infinitely far away is what people expect — flipping the direction should
  not drag every blank row to the top.
*/
function compareDue(a: Task, b: Task): number {
  if (a.dueDate === b.dueDate) return 0
  if (a.dueDate === null) return 1
  if (b.dueDate === null) return -1
  return a.dueDate < b.dueDate ? -1 : 1
}

/** Priority has an inherent order that alphabetical would destroy. */
function comparePriority(a: Task, b: Task): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}

/**
 * Rows for one list. With no sort, tasks appear in board order — grouped by
 * status column, then by position within it — so the two views agree.
 */
export function buildTaskList(
  statuses: Status[],
  tasks: Task[],
  listId: string,
  sort?: Sort,
): TaskRow[] {
  const byId = new Map(statuses.map((status) => [status.id, status]))

  const rows: TaskRow[] = []
  for (const task of tasks) {
    if (task.primaryListId !== listId) continue
    const status = byId.get(task.statusId)
    if (status) rows.push({ task, status })
  }

  if (!sort) {
    return rows.sort(
      (a, b) =>
        a.status.position - b.status.position || a.task.position - b.task.position,
    )
  }

  const compare = sort.key === 'due' ? compareDue : comparePriority
  const flip = sort.direction === 'desc' ? -1 : 1

  return rows.sort((a, b) => {
    // Undated rows stay at the bottom whichever way the column is sorted.
    if (sort.key === 'due' && (a.task.dueDate === null || b.task.dueDate === null)) {
      return compareDue(a.task, b.task)
    }
    return compare(a.task, b.task) * flip || a.task.title.localeCompare(b.task.title)
  })
}
