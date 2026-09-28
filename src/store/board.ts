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

/** A list's own statuses, left to right. */
export function statusesForList(statuses: Status[], listId: string): Status[] {
  return statuses
    .filter((status) => status.listId === listId)
    .sort((a, b) => a.position - b.position)
}

/**
 * Where a new task starts: the list's first not-started column.
 *
 * Matched on category rather than position, because a list can be reordered
 * and because the column is not always called "To Do" — Bugs calls it "Open".
 * Falls back to the leftmost column if a list somehow has no todo status.
 */
export function defaultStatusFor(statuses: Status[], listId: string): Status | undefined {
  const columns = statusesForList(statuses, listId)
  return columns.find((status) => status.category === 'todo') ?? columns[0]
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
  const columns = statusesForList(statuses, listId)

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

/**
 * What a board drag would do, were it released now.
 *
 * dnd-kit reports whichever droppable the pointer is over: a card when the
 * pointer is between cards, or the column itself when it is over empty space
 * below them. Both resolve to the same answer — a column and an index — so
 * the two callers (the live preview and the drop itself) cannot disagree
 * about where a card is going.
 *
 * Returns null when either id is unknown, which is how a drag that started
 * outside the board is ignored.
 */
export interface BoardDrop {
  statusId: string
  /** Position within that column the task would take. */
  index: number
  /** True when the card has not left the column it started in. */
  sameColumn: boolean
}

export function resolveBoardDrop(
  columns: BoardColumnData[],
  activeId: string,
  overId: string,
): BoardDrop | null {
  const source = columns.find((column) =>
    column.tasks.some((task) => task.id === activeId),
  )
  if (!source) return null

  // Over the column's empty space: the card lands at the end.
  const asColumn = columns.find((column) => column.status.id === overId)
  const target =
    asColumn ?? columns.find((column) => column.tasks.some((task) => task.id === overId))
  if (!target) return null

  const index = asColumn
    ? asColumn.tasks.length
    : target.tasks.findIndex((task) => task.id === overId)

  return {
    statusId: target.status.id,
    index,
    sameColumn: source.status.id === target.status.id,
  }
}
