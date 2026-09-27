import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { ChevronRight, Folder, Layers, List, MoreHorizontal, Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TreeNode } from '../../store/tree'
import { CHILD_TYPE, type ContainerType } from '../../types'

const ICON: Record<ContainerType, typeof Folder> = {
  workspace: Layers,
  space: Layers,
  folder: Folder,
  list: List,
}

const CHILD_LABEL: Record<ContainerType, string> = {
  workspace: 'space',
  space: 'folder',
  folder: 'list',
  list: '',
}

export interface TreeNodeHandlers {
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedListId: string | null
  editingId: string | null
  draftName: string
  onDraftChange: (name: string) => void
  onStartRename: (id: string, current: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onAddChild: (parentId: string, type: ContainerType) => void
  onArchive: (id: string) => void
}

type Props = TreeNodeHandlers & { node: TreeNode }

/*
  Indentation comes from padding on each nested <ul>, not from a depth-derived
  inline style — the brief forbids inline style= for layout.
*/
export function TreeNodeRow(props: Props) {
  const { node, expanded, onToggle, selectedListId, editingId } = props
  const { container, children } = node
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const isList = container.type === 'list'
  const isSelected = isList && selectedListId === container.id
  const isOpen = expanded.has(container.id)
  const hasChildren = children.length > 0
  const isEditing = editingId === container.id
  const childType = CHILD_TYPE[container.type]
  const Icon = ICON[container.type]

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  const action =
    'shrink-0 rounded p-1 text-slate-400 opacity-0 transition group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-slate-200/70 hover:text-slate-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand'

  return (
    <li>
      <div className="group/row flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onToggle(container.id)}
          aria-label={isOpen ? `Collapse ${container.name}` : `Expand ${container.name}`}
          aria-expanded={hasChildren ? isOpen : undefined}
          disabled={!hasChildren}
          className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:invisible"
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {isEditing ? (
          <input
            ref={inputRef}
            aria-label={`Rename ${container.name}`}
            value={props.draftName}
            onChange={(event) => props.onDraftChange(event.target.value)}
            onBlur={props.onCommitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') props.onCommitRename()
              if (event.key === 'Escape') props.onCancelRename()
            }}
            className="min-w-0 flex-1 rounded-card border border-brand px-1.5 py-1 text-sm text-slate-900 focus:outline-none"
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                isList ? navigate(`/list/${container.id}`) : onToggle(container.id)
              }
              aria-current={isSelected ? 'page' : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-card px-1.5 py-1.5 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
                isSelected
                  ? 'bg-brand/10 font-medium text-brand'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Icon
                size={15}
                className={`shrink-0 ${isSelected ? 'text-brand' : 'text-slate-400'}`}
              />
              <span className="truncate">{container.name}</span>
            </button>

            {childType && (
              <button
                type="button"
                onClick={() => props.onAddChild(container.id, childType)}
                aria-label={`Add ${CHILD_LABEL[container.type]} to ${container.name}`}
                className={action}
              >
                <Plus size={13} />
              </button>
            )}

            {container.type !== 'workspace' && (
              <Menu>
                <MenuButton
                  aria-label={`Actions for ${container.name}`}
                  className={`${action} data-open:opacity-100`}
                >
                  <MoreHorizontal size={13} />
                </MenuButton>
                <MenuItems
                  anchor="bottom end"
                  transition
                  className="z-50 w-36 rounded-card border border-line bg-white p-1 shadow-pop [--anchor-gap:4px] focus:outline-none data-closed:opacity-0"
                >
                  <MenuItem>
                    <button
                      type="button"
                      onClick={() => props.onStartRename(container.id, container.name)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 data-focus:bg-slate-100"
                    >
                      Rename
                    </button>
                  </MenuItem>
                  <MenuItem>
                    {/* Labelled "Delete" because that is what users expect to
                        look for, but it archives: a soft delete that keeps the
                        record and its tasks, so nothing is lost. */}
                    <button
                      type="button"
                      onClick={() => props.onArchive(container.id)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm text-accent-red data-focus:bg-accent-red/10"
                    >
                      Delete
                    </button>
                  </MenuItem>
                </MenuItems>
              </Menu>
            )}
          </>
        )}
      </div>

      {hasChildren && isOpen && (
        <ul className="pl-3">
          {children.map((child) => (
            <TreeNodeRow key={child.container.id} {...props} node={child} />
          ))}
        </ul>
      )}
    </li>
  )
}
