import { LayoutGrid, Rows3 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useViewMode, type ViewMode } from './useViewMode'

const OPTIONS: { value: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { value: 'board', label: 'Board', Icon: LayoutGrid },
  { value: 'list', label: 'List', Icon: Rows3 },
]

export function ViewToggle() {
  const [params, setParams] = useSearchParams()
  const current = useViewMode()

  const select = (mode: ViewMode) => {
    const next = new URLSearchParams(params)
    if (mode === 'board') next.delete('view')
    else next.set('view', mode)
    // Sorting only applies to the list view.
    if (mode === 'board') {
      next.delete('sort')
      next.delete('dir')
    }
    setParams(next)
  }

  return (
    <div
      role="tablist"
      aria-label="View"
      className="flex items-center gap-0.5 rounded-card bg-slate-100 p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => select(value)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
              active
                ? 'bg-white font-medium text-slate-900 shadow-card'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
