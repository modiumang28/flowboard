import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import { isError } from '../../lib/result'
import { SidebarSkeleton } from '../../components/Skeleton'
import { useStore } from '../../store/store'
import { buildTree, collectIds, resolveSiblingDrop } from '../../store/tree'
import type { ContainerType } from '../../types'
import { TreeNodeRow, type PendingChild } from './TreeNodeRow'

/*
  The selection comes from useMatch rather than useParams: the sidebar renders
  outside <Routes>, so it has no matched route of its own to read params from.
*/
export function Sidebar() {
  const containers = useStore((state) => state.containers)
  const createContainer = useStore((state) => state.createContainer)
  const renameContainer = useStore((state) => state.renameContainer)
  const archiveContainer = useStore((state) => state.archiveContainer)
  const reorderContainer = useStore((state) => state.reorderContainer)

  const isReady = useStore((state) => state.isReady)

  const navigate = useNavigate()
  const selectedListId = useMatch('/list/:listId')?.params.listId ?? null

  const tree = useMemo(() => buildTree(Object.values(containers)), [containers])

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree ? collectIds(tree) : []),
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  // A child being named under its parent. Nothing exists in the store until a
  // name is submitted, so an empty or abandoned name leaves nothing behind.
  const [pendingChild, setPendingChild] = useState<PendingChild | null>(null)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  /*
    Rows double as buttons, so a drag only begins after the pointer travels a
    little — otherwise selecting a list would start a drag. The keyboard sensor
    makes reordering reachable without a mouse (Space to lift, arrows to move,
    Space to drop), and is also what the drag tests drive.
  */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const startRename = (id: string, current: string) => {
    setPendingChild(null)
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

  /* "+" opens an empty name field under the parent; the container is only
     created once a name is submitted. */
  const addChild = (parentId: string, type: ContainerType) => {
    setEditingId(null)
    setDraftName('')
    setError(null)
    setPendingChild({ parentId, type })
    setExpanded((current) => new Set(current).add(parentId))
  }

  /* Returns whether the field can close. A blank name never reaches the store:
     it is simply not a submission. */
  const submitChild = (): boolean => {
    if (!pendingChild || draftName.trim() === '') return false
    const result = createContainer(pendingChild.parentId, pendingChild.type, draftName)
    if (isError(result)) {
      setError(result.error.message)
      return false
    }
    setError(null)
    setPendingChild(null)
    return true
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

  /*
    Every row is a droppable in one context, so plain closestCenter resolves a
    drag to whatever is nearest anywhere in the tree — dragging Bugs upwards
    landed on the workspace, three levels away. Narrowing the candidates to the
    dragged node's own siblings makes a cross-level drop impossible.

    The dragged row stays among the candidates on purpose: it is what a drag
    that has not really gone anywhere resolves to, and the drop is then a
    no-op. Excluding it meant the nudge that starts a drag already counted as
    a reorder.
  */
  const siblingCollisions: CollisionDetection = (args) => {
    const parentId = containers[String(args.active.id)]?.parentId
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (droppable) => containers[String(droppable.id)]?.parentId === parentId,
      ),
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    if (!over) return

    const drop = resolveSiblingDrop(containers, String(active.id), String(over.id))
    if (!drop) return

    const result = reorderContainer(drop.containerId, drop.toIndex)
    if (isError(result)) setError(result.error.message)
  }

  const dragging = draggingId ? containers[draggingId] : null

  return (
    <nav
      aria-label="Workspace"
      className="flex w-64 shrink-0 flex-col border-r border-line bg-white"
    >
      {/* Matches the top bar's height so the two headers line up. */}
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
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

      <div className="flex-1 overflow-y-auto p-2" aria-busy={!isReady} aria-live="polite">
        {!isReady ? (
          <>
            <span className="sr-only">Loading workspace</span>
            <SidebarSkeleton />
          </>
        ) : tree ? (
          <DndContext
            sensors={sensors}
            collisionDetection={siblingCollisions}
            onDragStart={({ active }: DragStartEvent) => setDraggingId(String(active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingId(null)}
          >
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
                pendingChild={pendingChild}
                onSubmitChild={submitChild}
                onCancelChild={() => setPendingChild(null)}
                onArchive={archive}
              />
            </ul>

            <DragOverlay>
              {dragging ? (
                <span className="inline-block rounded-card border border-line bg-white px-2 py-1.5 text-sm text-slate-700 shadow-drag">
                  {dragging.name}
                </span>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            Nothing to show here.
          </p>
        )}
      </div>
    </nav>
  )
}
