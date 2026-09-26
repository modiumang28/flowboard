import { useMemo, useState } from 'react'
import { useMatch } from 'react-router-dom'
import { useStore } from '../../store/store'
import { buildTree, collectIds } from '../../store/tree'
import { TreeNodeRow } from './TreeNodeRow'

/*
  The selection comes from useMatch rather than useParams: the sidebar renders
  outside <Routes>, so it has no matched route of its own to read params from.
*/
export function Sidebar() {
  const containers = useStore((state) => state.containers)
  const tree = useMemo(() => buildTree(Object.values(containers)), [containers])
  const selectedListId = useMatch('/list/:listId')?.params.listId ?? null

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree ? collectIds(tree) : []),
  )

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <nav
      aria-label="Workspace"
      className="flex w-64 shrink-0 flex-col border-r border-line bg-white"
    >
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Flowboard</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tree ? (
          <ul>
            <TreeNodeRow
              node={tree}
              expanded={expanded}
              onToggle={toggle}
              selectedListId={selectedListId}
            />
          </ul>
        ) : (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            Nothing to show here.
          </p>
        )}
      </div>
    </nav>
  )
}
