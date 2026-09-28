import type { Container, Status, Task } from '../types'
import { canViewContainer, type PermissionState } from './permissions'

/*
  Search runs across every list, not just the open one — which is the whole
  point of it, and also the reason it has to go through the permission check.

  A global search is the easiest place in an app like this to leak: without
  filtering, Bob searching "crash" would surface a task from the Bugs list he
  is explicitly denied, title and all. So results are filtered by the same
  canViewContainer used by the sidebar, rather than by a separate rule that
  could drift from it.
*/

export interface SearchState extends PermissionState {
  tasks: Record<string, Task>
  statuses: Record<string, Status>
}

export interface SearchResult {
  task: Task
  list: Container
  status: Status
  /** Which field matched, so the result can show the description snippet. */
  matchedIn: 'title' | 'description'
}

/** Keeps the dropdown to a readable length; the query can always be narrowed. */
const MAX_RESULTS = 20

/**
 * Tasks whose title or description contains the query, in lists the user can
 * reach.
 *
 * Title matches rank above description-only matches: someone typing a word
 * they remember from a task name should not have to scroll past everything
 * that merely mentions it.
 */
export function searchTasks(
  state: SearchState,
  userId: string,
  query: string,
  limit = MAX_RESULTS,
): SearchResult[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return []

  // One decision per list rather than per task — the walk up the tree is the
  // expensive part, and every task in a list shares the answer.
  const listAllowed = new Map<string, boolean>()
  const allowed = (listId: string) => {
    const cached = listAllowed.get(listId)
    if (cached !== undefined) return cached
    const result = canViewContainer(state, userId, listId)
    listAllowed.set(listId, result)
    return result
  }

  const results: SearchResult[] = []

  for (const task of Object.values(state.tasks)) {
    const inTitle = task.title.toLowerCase().includes(needle)
    const inDescription = task.description.toLowerCase().includes(needle)
    if (!inTitle && !inDescription) continue

    if (!allowed(task.primaryListId)) continue

    const list = state.containers[task.primaryListId]
    const status = state.statuses[task.statusId]
    if (!list || !status) continue

    results.push({ task, list, status, matchedIn: inTitle ? 'title' : 'description' })
  }

  return results
    .sort((a, b) => {
      if (a.matchedIn !== b.matchedIn) return a.matchedIn === 'title' ? -1 : 1
      return a.task.title.localeCompare(b.task.title)
    })
    .slice(0, limit)
}

/**
 * A short window of the description around the match, so a result explains
 * itself rather than showing an unrelated opening sentence.
 */
export function descriptionSnippet(description: string, query: string): string {
  const needle = query.trim().toLowerCase()
  const at = description.toLowerCase().indexOf(needle)
  if (at === -1) return description.slice(0, 80)

  const start = Math.max(0, at - 24)
  const end = Math.min(description.length, at + needle.length + 48)

  return `${start > 0 ? '…' : ''}${description.slice(start, end)}${
    end < description.length ? '…' : ''
  }`
}
