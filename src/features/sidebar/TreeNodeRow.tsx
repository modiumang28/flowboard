import { ChevronRight, Folder, Layers, List } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { TreeNode } from '../../store/tree'
import type { ContainerType } from '../../types'

const ICON: Record<ContainerType, typeof Folder> = {
  workspace: Layers,
  space: Layers,
  folder: Folder,
  list: List,
}

interface Props {
  node: TreeNode
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedListId: string | null
}

/*
  Indentation comes from padding on each nested <ul>, not from a depth-derived
  inline style — the brief forbids inline style= for layout.
*/
export function TreeNodeRow({ node, expanded, onToggle, selectedListId }: Props) {
  const { container, children } = node
  const navigate = useNavigate()

  const isList = container.type === 'list'
  const isSelected = isList && selectedListId === container.id
  const isOpen = expanded.has(container.id)
  const hasChildren = children.length > 0
  const Icon = ICON[container.type]

  return (
    <li>
      <div className="flex items-center gap-0.5">
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
      </div>

      {hasChildren && isOpen && (
        <ul className="pl-3">
          {children.map((child) => (
            <TreeNodeRow
              key={child.container.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              selectedListId={selectedListId}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
