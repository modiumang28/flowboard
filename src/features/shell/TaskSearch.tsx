import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCENT_FILL } from '../../lib/accents'
import { descriptionSnippet, searchTasks, type SearchResult } from '../../store/search'
import { useStore } from '../../store/store'

/*
  Search spans every list, which is what makes it worth having and also what
  makes it a permission surface: the selector filters results by the same
  check the sidebar uses, so a denied task cannot surface here by its title.

  Headless UI's Combobox supplies the keyboard behaviour — arrows to move,
  Enter to open, Escape to dismiss — along with the ARIA that makes the
  results list announce itself.
*/
export function TaskSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const tasks = useStore((state) => state.tasks)
  const containers = useStore((state) => state.containers)
  const statuses = useStore((state) => state.statuses)
  const grants = useStore((state) => state.grants)
  const users = useStore((state) => state.users)
  const currentUserId = useStore((state) => state.currentUserId)

  const results = useMemo(
    () =>
      searchTasks({ tasks, containers, statuses, grants, users }, currentUserId, query),
    [tasks, containers, statuses, grants, users, currentUserId, query],
  )

  const open = (result: SearchResult | null) => {
    if (!result) return
    navigate(`/list/${result.list.id}?task=${result.task.id}`)
    setQuery('')
  }

  const hasQuery = query.trim().length > 0

  return (
    <Combobox<SearchResult | null> value={null} onChange={open} immediate>
      <div className="relative w-56">
        <Search
          size={14}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
        />
        <ComboboxInput
          aria-label="Search tasks"
          placeholder="Search tasks…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-card border border-line bg-white py-1.5 pr-7 pl-7.5 text-sm text-slate-800 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:outline-none"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {hasQuery && (
        <ComboboxOptions
          anchor="bottom start"
          /*
            Headless UI marks the rest of the page inert while the list is
            open, which is right for a dialog but wrong here — it also blocks
            the clear button sitting inside the input the user is typing in.
          */
          modal={false}
          className="z-50 mt-1 w-96 rounded-panel border border-line bg-white p-1 shadow-pop [--anchor-gap:4px] empty:hidden focus:outline-none"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">
              No tasks match “{query.trim()}”.
            </p>
          ) : (
            results.map((result) => (
              <ComboboxOption
                key={result.task.id}
                value={result}
                className="cursor-pointer rounded-card px-2.5 py-2 select-none data-focus:bg-slate-100"
              >
                <p className="truncate text-sm font-medium text-slate-900">
                  {result.task.title}
                </p>

                {result.matchedIn === 'description' && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {descriptionSnippet(result.task.description, query)}
                  </p>
                )}

                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="truncate">{result.list.name}</span>
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${ACCENT_FILL[result.status.color]}`}
                  />
                  <span className="truncate">{result.status.name}</span>
                </p>
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      )}
    </Combobox>
  )
}
