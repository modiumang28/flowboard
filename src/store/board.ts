import type { Status, Task } from '../types'

/*
  Groups a list's tasks into its own status columns. Pure, like buildTree — it
  takes the data as arguments so it works against the seed now and the store
  later without changing.
*/

export interface BoardColumnData {
  status: Status
  tasks: Task[]
}

/**
 * Columns for one list, ordered left to right, each holding that column's
 * tasks in position order.
 *
 * Only statuses owned by `listId` are returned, which is what makes each list
 * render its own column set rather than a shared one.
 */
export function buildBoard(
  statuses: Status[],
  tasks: Task[],
  listId: string,
): BoardColumnData[] {
  const columns = statuses
    .filter((status) => status.listId === listId)
    .sort((a, b) => a.position - b.position)

  const tasksByStatus = new Map<string, Task[]>()
  for (const task of tasks) {
    if (task.primaryListId !== listId) continue
    const column = tasksByStatus.get(task.statusId)
    if (column) column.push(task)
    else tasksByStatus.set(task.statusId, [task])
  }

  return columns.map((status) => ({
    status,
    tasks: (tasksByStatus.get(status.id) ?? []).sort((a, b) => a.position - b.position),
  }))
}
