import { seedStatuses, seedTasks, seedUsers } from '../../data/seed'
import { buildBoard } from '../../store/board'
import { BoardColumn } from './BoardColumn'

/*
  Reads the seed directly for now, like the sidebar. Phase 3 swaps these three
  imports for permission-aware store selectors; nothing below changes.
*/
export function Board({ listId }: { listId: string }) {
  const columns = buildBoard(seedStatuses, seedTasks, listId)

  if (columns.length === 0) {
    return (
      <p className="px-6 py-10 text-sm text-slate-500">
        This list has no statuses configured.
      </p>
    )
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto px-6 pb-6">
      {columns.map((column) => (
        <BoardColumn key={column.status.id} column={column} users={seedUsers} />
      ))}
    </div>
  )
}
