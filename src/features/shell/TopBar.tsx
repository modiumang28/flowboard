import { ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMatch } from 'react-router-dom'
import { listAccess } from '../../store/permissions'
import { useStore } from '../../store/store'
import { ancestorsOf } from '../../store/tree'
import { CreateTaskDialog } from '../task/CreateTaskDialog'
import { TaskSearch } from './TaskSearch'
import { UserSwitcher } from './UserSwitcher'
import { ViewToggle } from './ViewToggle'

/*
  The app chrome the brief asks for: sidebar + top bar + main content. The
  breadcrumb lives here rather than above the board, so the bar carries the
  "where am I" information and the main area is left for the work itself.
*/
export function TopBar() {
  const containers = useStore((state) => state.containers)
  const listId = useMatch('/list/:listId')?.params.listId ?? null

  /*
    A list the current user cannot reach is treated as if none were open: no
    Create, no view toggle, and no breadcrumb. The breadcrumb matters most —
    it names every ancestor, so rendering it for a denied list would spell out
    the structure of a space the user is not allowed to know about.
  */
  const isOpen = useStore(
    (state) => listId !== null && listAccess(state, state.currentUserId, listId) === 'ok',
  )

  const [isCreating, setIsCreating] = useState(false)

  const trail = useMemo(
    () => (isOpen && listId ? ancestorsOf(containers, listId) : []),
    [containers, listId, isOpen],
  )

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-white px-5">
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 shrink">
        {trail.length > 0 ? (
          <ol className="flex min-w-0 items-center gap-1 text-sm">
            {trail.map((container, index) => {
              const isLast = index === trail.length - 1
              return (
                <li key={container.id} className="flex min-w-0 items-center gap-1">
                  {index > 0 && (
                    <ChevronRight size={14} className="shrink-0 text-slate-300" />
                  )}
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={`truncate ${
                      isLast ? 'font-medium text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {container.name}
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-sm text-slate-400">No list selected</p>
        )}
      </nav>

      {/* Search spans the workspace, so it does not depend on a list being open. */}
      <TaskSearch />

      {/* These two only mean anything once a reachable list is open. */}
      {isOpen && (
        <>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-card bg-brand px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          >
            <Plus size={14} />
            Create
          </button>
          <ViewToggle />
        </>
      )}

      <UserSwitcher />

      {isOpen && listId && isCreating && (
        <CreateTaskDialog listId={listId} onClose={() => setIsCreating(false)} />
      )}
    </header>
  )
}
