import { useMemo, useState } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import { isError } from '../../lib/result'
import { useStore } from '../../store/store'
import { buildTree, collectIds } from '../../store/tree'
import type { ContainerType } from '../../types'
import { TreeNodeRow } from './TreeNodeRow'

const NEW_NAME: Record<ContainerType, string> = {
  workspace: 'Workspace',
  space: 'New space',
  folder: 'New folder',
  list: 'New list',
}

/*
  The selection comes from useMatch rather than useParams: the sidebar renders
  outside <Routes>, so it has no matched route of its own to read params from.
*/
export function Sidebar() {
  const containers = useStore((state) => state.containers)
  const createContainer = useStore((state) => state.createContainer)
  const renameContainer = useStore((state) => state.renameContainer)
  const archiveContainer = useStore((state) => state.archiveContainer)

  const navigate = useNavigate()
  const selectedListId = useMatch('/list/:listId')?.params.listId ?? null
  const tree = useMemo(() => buildTree(Object.values(containers)), [containers])

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree ? collectIds(tree) : []),
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const startRename = (id: string, current: string) => {
    setDraftName(current)
    setEditingId(id)
    setError(null)
  }

  const commitRename = () => {
    if (!editingId) return
    const result = renameContainer(editingId, draftName)
    if (isError(result)) setError(result.error.message)
    else setError(null)
    setEditingId(null)
  }

  /* New items are created with a placeholder name and opened for renaming
     straight away, so naming is one gesture rather than a separate dialog. */
  const addChild = (parentId: string, type: ContainerType) => {
    const result = createContainer(parentId, type, NEW_NAME[type])
    if (isError(result)) {
      setError(result.error.message)
      return
    }
    setExpanded((current) => new Set(current).add(parentId))
    startRename(result.data.id, result.data.name)
  }

  const archive = (id: string) => {
    const result = archiveContainer(id)
    if (isError(result)) {
      setError(result.error.message)
      return
    }
    setError(null)

    // The open list may have been archived, or been nested inside what was.
    if (selectedListId) {
      const remaining = buildTree(Object.values(useStore.getState().containers))
      const visible = remaining ? collectIds(remaining) : []
      if (!visible.includes(selectedListId)) navigate('/list')
    }
  }

  return (
    <nav
      aria-label="Workspace"
      className="flex w-64 shrink-0 flex-col border-r border-line bg-white"
    >
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Flowboard</p>
      </div>

      {error && (
        <p
          role="alert"
          className="border-b border-line bg-accent-red/10 px-4 py-2 text-xs text-accent-red"
        >
          {error}
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {tree ? (
          <ul>
            <TreeNodeRow
              node={tree}
              expanded={expanded}
              onToggle={toggle}
              selectedListId={selectedListId}
              editingId={editingId}
              draftName={draftName}
              onDraftChange={setDraftName}
              onStartRename={startRename}
              onCommitRename={commitRename}
              onCancelRename={() => setEditingId(null)}
              onAddChild={addChild}
              onArchive={archive}
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
