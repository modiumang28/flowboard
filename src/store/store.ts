import { create } from 'zustand'
import {
  DEFAULT_USER_ID,
  seedContainers,
  seedGrants,
  seedStatuses,
  seedTasks,
  seedUsers,
} from '../data/seed'
import { err, ok, type Result } from '../lib/result'
import {
  MAX_TITLE_LENGTH,
  VALID_PARENT_TYPE,
  type Container,
  type ContainerType,
  type Grant,
  type Priority,
  type Status,
  type StatusCategory,
  type Task,
  type User,
} from '../types'
import { loadState } from './persistence'

/*
  The single source of truth, and the only place data changes.

  State is stored flat, keyed by id — the tree and the board are derived on
  read by selectors, never stored. Every mutation returns a Result rather than
  throwing, so failure is part of the signature and callers cannot ignore it.

  Permission checks belong in these actions and in the selectors; they arrive
  in the next phase.
*/

export interface StoreState {
  /*
    False until the persistence adapter has answered. Views render skeletons
    while it is false, which is the one genuine wait the app has — no delay is
    staged anywhere else, because slowing the app down to show a spinner would
    be worse than having none.
  */
  isReady: boolean
  containers: Record<string, Container>
  statuses: Record<string, Status>
  tasks: Record<string, Task>
  users: Record<string, User>
  grants: Grant[]
  currentUserId: string
}

/** The fields a person may edit directly. Position and list moves have their own actions. */
export type TaskPatch = Partial<
  Pick<
    Task,
    'title' | 'description' | 'statusId' | 'priority' | 'assigneeIds' | 'dueDate'
  >
>

/** Everything a new task can carry. Only a title and a status are required. */
export interface NewTask {
  title: string
  statusId: string
  description?: string
  priority?: Priority
  assigneeIds?: string[]
  dueDate?: string | null
}

export interface StoreActions {
  createContainer: (
    parentId: string,
    type: ContainerType,
    name: string,
  ) => Result<Container>
  renameContainer: (containerId: string, name: string) => Result<Container>
  archiveContainer: (containerId: string) => Result<Container>
  reorderContainer: (containerId: string, toIndex: number) => Result<Container>
  createTask: (listId: string, draft: NewTask) => Result<Task>
  deleteTask: (taskId: string) => Result<Task>
  updateTask: (taskId: string, patch: TaskPatch) => Result<Task>
  moveTaskToList: (taskId: string, listId: string) => Result<Task>
  reorderTask: (taskId: string, toIndex: number) => Result<Task>
  moveTaskToStatus: (taskId: string, statusId: string, toIndex: number) => Result<Task>
  setCurrentUser: (userId: string) => void
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

/** Ready by definition — tests set this directly and expect a usable store. */
export function seededState(): StoreState {
  return {
    isReady: true,
    containers: byId(seedContainers),
    statuses: byId(seedStatuses),
    tasks: byId(seedTasks),
    users: byId(seedUsers),
    grants: seedGrants,
    currentUserId: DEFAULT_USER_ID,
  }
}

/** Next free slot at the bottom of a status column. */
function nextPosition(tasks: Record<string, Task>, statusId: string): number {
  const positions = Object.values(tasks)
    .filter((task) => task.statusId === statusId)
    .map((task) => task.position)
  return positions.length === 0 ? 0 : Math.max(...positions) + 1
}

/*
  Every new list needs its own status set straight away — the brief requires a
  minimum of todo / in progress / done, and a list with no statuses would
  render an empty board.
*/
const DEFAULT_STATUSES: {
  name: string
  category: StatusCategory
  color: Status['color']
}[] = [
  { name: 'To Do', category: 'todo', color: 'slate' },
  { name: 'In Progress', category: 'active', color: 'blue' },
  { name: 'Done', category: 'done', color: 'green' },
]

export const useStore = create<StoreState & StoreActions>()((set, get) => ({
  // Seeded so the shape is valid from the first render, but not ready: what
  // is on disk has not been read yet, and hydrate() below decides which wins.
  ...seededState(),
  isReady: false,

  createContainer(parentId, type, name) {
    const state = get()
    const trimmed = name.trim()
    if (trimmed.length === 0) return err('VALIDATION', 'A name is required.')

    const parent = state.containers[parentId]
    if (!parent) return err('NOT_FOUND', 'That parent no longer exists.')

    // workspace -> space -> folder -> list, and nothing else.
    if (VALID_PARENT_TYPE[type] !== parent.type) {
      return err('INVALID_PARENT', `A ${type} cannot sit inside a ${parent.type}.`)
    }

    const siblings = Object.values(state.containers).filter(
      (container) => container.parentId === parentId,
    )
    const container: Container = {
      id: crypto.randomUUID(),
      name: trimmed,
      type,
      parentId,
      position:
        siblings.length === 0 ? 0 : Math.max(...siblings.map((s) => s.position)) + 1,
      visibility: 'public',
      archivedAt: null,
    }

    const statuses: Record<string, Status> = {}
    if (type === 'list') {
      DEFAULT_STATUSES.forEach((preset, index) => {
        const id = crypto.randomUUID()
        statuses[id] = { id, listId: container.id, ...preset, position: index }
      })
    }

    set((current) => ({
      containers: { ...current.containers, [container.id]: container },
      statuses: { ...current.statuses, ...statuses },
    }))
    return ok(container)
  },

  renameContainer(containerId, name) {
    const state = get()
    const container = state.containers[containerId]
    if (!container) return err('NOT_FOUND', 'That item no longer exists.')

    const trimmed = name.trim()
    if (trimmed.length === 0) return err('VALIDATION', 'A name is required.')
    if (trimmed === container.name) return ok(container)

    const renamed = { ...container, name: trimmed }
    set((current) => ({
      containers: { ...current.containers, [containerId]: renamed },
    }))
    return ok(renamed)
  },

  /*
    Soft delete: the record stays and only stops being visible. The subtree
    goes with it for free — buildTree never reaches children whose parent was
    filtered out — so nothing has to be cascaded by hand.
  */
  archiveContainer(containerId) {
    const state = get()
    const container = state.containers[containerId]
    if (!container) return err('NOT_FOUND', 'That item no longer exists.')
    if (container.type === 'workspace') {
      return err('VALIDATION', 'The workspace cannot be archived.')
    }
    if (container.archivedAt) return ok(container)

    const archived = { ...container, archivedAt: new Date().toISOString() }
    const siblings = Object.values(state.containers)
      .filter(
        (other) =>
          other.parentId === container.parentId &&
          other.id !== containerId &&
          other.archivedAt === null,
      )
      .sort((a, b) => a.position - b.position)

    const changed: Record<string, Container> = { [containerId]: archived }
    siblings.forEach((sibling, index) => {
      if (sibling.position !== index)
        changed[sibling.id] = { ...sibling, position: index }
    })

    set((current) => ({ containers: { ...current.containers, ...changed } }))
    return ok(archived)
  },

  reorderContainer(containerId, toIndex) {
    const state = get()
    const container = state.containers[containerId]
    if (!container) return err('NOT_FOUND', 'That item no longer exists.')
    if (container.parentId === null) {
      return err('VALIDATION', 'The workspace has no siblings to reorder among.')
    }

    const siblings = Object.values(state.containers)
      .filter(
        (other) => other.parentId === container.parentId && other.archivedAt === null,
      )
      .sort((a, b) => a.position - b.position)

    const from = siblings.findIndex((other) => other.id === containerId)
    const to = Math.max(0, Math.min(toIndex, siblings.length - 1))
    if (from === to) return ok(container)

    siblings.splice(to, 0, ...siblings.splice(from, 1))

    const changed: Record<string, Container> = {}
    siblings.forEach((sibling, index) => {
      if (sibling.position !== index)
        changed[sibling.id] = { ...sibling, position: index }
    })

    set((current) => ({ containers: { ...current.containers, ...changed } }))
    return ok(get().containers[containerId])
  },

  /*
    Everything the create form collects arrives in one call, so a new task is
    a single mutation with a single timestamp rather than a create followed by
    an edit. Only the title and status are required; the rest default to the
    same empty values an existing task would have.
  */
  createTask(listId, draft) {
    const state = get()
    const { statusId } = draft

    const trimmed = draft.title.trim()
    if (trimmed.length === 0) return err('VALIDATION', 'A task needs a title.')
    if (trimmed.length > MAX_TITLE_LENGTH) {
      return err('VALIDATION', `Titles are limited to ${MAX_TITLE_LENGTH} characters.`)
    }

    const list = state.containers[listId]
    if (!list || list.type !== 'list')
      return err('NOT_FOUND', 'That list no longer exists.')
    if (list.archivedAt) return err('NOT_FOUND', 'That list has been deleted.')

    const status = state.statuses[statusId]
    if (!status) return err('NOT_FOUND', 'That status no longer exists.')
    if (status.listId !== listId) {
      return err('VALIDATION', 'That status belongs to a different list.')
    }

    const unknownAssignee = draft.assigneeIds?.find((id) => !state.users[id])
    if (unknownAssignee) return err('NOT_FOUND', 'That user no longer exists.')

    const now = new Date().toISOString()
    const task: Task = {
      id: crypto.randomUUID(),
      title: trimmed,
      description: draft.description?.trim() ?? '',
      primaryListId: listId,
      statusId,
      priority: draft.priority ?? 'none',
      assigneeIds: draft.assigneeIds ?? [],
      dueDate: draft.dueDate ?? null,
      position: nextPosition(state.tasks, statusId),
      createdAt: now,
      updatedAt: now,
    }

    set((current) => ({ tasks: { ...current.tasks, [task.id]: task } }))
    return ok(task)
  },

  /*
    Tasks are removed outright, unlike containers. The brief asks for
    soft-delete on the hierarchy, where losing a branch would take its tasks
    with it; a single task has nothing hanging off it, so a real delete is the
    honest behaviour. The column is renumbered so no gap is left behind.
  */
  deleteTask(taskId) {
    const state = get()
    const task = state.tasks[taskId]
    if (!task) return err('NOT_FOUND', 'That task no longer exists.')

    const now = new Date().toISOString()
    const remaining: Record<string, Task> = {}
    for (const [id, other] of Object.entries(state.tasks)) {
      if (id !== taskId) remaining[id] = other
    }

    Object.values(remaining)
      .filter((other) => other.statusId === task.statusId)
      .sort((a, b) => a.position - b.position)
      .forEach((other, index) => {
        if (other.position !== index) {
          remaining[other.id] = { ...other, position: index, updatedAt: now }
        }
      })

    set({ tasks: remaining })
    return ok(task)
  },

  updateTask(taskId, patch) {
    const state = get()
    const task = state.tasks[taskId]
    if (!task) return err('NOT_FOUND', 'That task no longer exists.')

    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (title.length === 0) return err('VALIDATION', 'A task needs a title.')
      if (title.length > MAX_TITLE_LENGTH) {
        return err('VALIDATION', `Titles are limited to ${MAX_TITLE_LENGTH} characters.`)
      }
    }

    // A task may only use a status belonging to its own list.
    if (patch.statusId !== undefined) {
      const status = state.statuses[patch.statusId]
      if (!status) return err('NOT_FOUND', 'That status no longer exists.')
      if (status.listId !== task.primaryListId) {
        return err('VALIDATION', 'That status belongs to a different list.')
      }
    }

    if (patch.assigneeIds) {
      const unknown = patch.assigneeIds.find((id) => !state.users[id])
      if (unknown) return err('NOT_FOUND', 'That user no longer exists.')
    }

    const updated: Task = {
      ...task,
      ...patch,
      title: patch.title?.trim() ?? task.title,
      updatedAt: new Date().toISOString(),
    }

    set((current) => ({ tasks: { ...current.tasks, [taskId]: updated } }))
    return ok(updated)
  },

  moveTaskToList(taskId, listId) {
    const state = get()
    const task = state.tasks[taskId]
    if (!task) return err('NOT_FOUND', 'That task no longer exists.')

    const list = state.containers[listId]
    if (!list || list.type !== 'list')
      return err('NOT_FOUND', 'That list no longer exists.')
    if (task.primaryListId === listId) return ok(task)

    /*
      Statuses are owned per list, so the current one does not exist on the
      destination board and the task would render nowhere. Category is the
      shared vocabulary between two lists, so match on that and fall back to
      the first column.
     */
    const current = state.statuses[task.statusId]
    const destination = Object.values(state.statuses)
      .filter((status) => status.listId === listId)
      .sort((a, b) => a.position - b.position)
    if (destination.length === 0) {
      return err('VALIDATION', 'That list has no statuses configured.')
    }
    const nextStatus =
      destination.find((status) => status.category === current?.category) ??
      destination[0]

    const updated: Task = {
      ...task,
      primaryListId: listId,
      statusId: nextStatus.id,
      position: nextPosition(state.tasks, nextStatus.id),
      updatedAt: new Date().toISOString(),
    }

    set((currentState) => ({ tasks: { ...currentState.tasks, [taskId]: updated } }))
    return ok(updated)
  },

  /*
    Moves a task to a new slot in its own status column. Positions are
    renumbered 0..n-1 across the column rather than nudged, so they stay dense
    and there is no drift to clean up later. At this scale the rewrite is
    cheaper than the bookkeeping fractional indexing would need.
  */
  reorderTask(taskId, toIndex) {
    const state = get()
    const task = state.tasks[taskId]
    if (!task) return err('NOT_FOUND', 'That task no longer exists.')

    const column = Object.values(state.tasks)
      .filter((other) => other.statusId === task.statusId)
      .sort((a, b) => a.position - b.position)

    const from = column.findIndex((other) => other.id === taskId)
    const to = Math.max(0, Math.min(toIndex, column.length - 1))
    if (from === to) return ok(task)

    column.splice(to, 0, ...column.splice(from, 1))

    const now = new Date().toISOString()
    const renumbered: Record<string, Task> = {}
    column.forEach((other, index) => {
      if (other.position !== index) {
        renumbered[other.id] = { ...other, position: index, updatedAt: now }
      }
    })

    set((current) => ({ tasks: { ...current.tasks, ...renumbered } }))
    return ok(get().tasks[taskId])
  },

  /*
    Drops a task into a different column of the same list — the kanban
    "change status" gesture. Both the column it left and the one it joined are
    renumbered, so neither is left with a gap or a duplicate position.
  */
  moveTaskToStatus(taskId, statusId, toIndex) {
    const state = get()
    const task = state.tasks[taskId]
    if (!task) return err('NOT_FOUND', 'That task no longer exists.')

    const status = state.statuses[statusId]
    if (!status) return err('NOT_FOUND', 'That status no longer exists.')
    if (status.listId !== task.primaryListId) {
      return err('VALIDATION', 'That status belongs to a different list.')
    }
    if (task.statusId === statusId) return get().reorderTask(taskId, toIndex)

    const now = new Date().toISOString()
    const changed: Record<string, Task> = {}

    // Close the gap left behind.
    Object.values(state.tasks)
      .filter((other) => other.statusId === task.statusId && other.id !== taskId)
      .sort((a, b) => a.position - b.position)
      .forEach((other, index) => {
        if (other.position !== index) {
          changed[other.id] = { ...other, position: index, updatedAt: now }
        }
      })

    // Insert into the destination and renumber it.
    const destination = Object.values(state.tasks)
      .filter((other) => other.statusId === statusId)
      .sort((a, b) => a.position - b.position)
    const at = Math.max(0, Math.min(toIndex, destination.length))
    destination.splice(at, 0, { ...task, statusId })

    destination.forEach((other, index) => {
      if (other.id === taskId) {
        changed[taskId] = { ...task, statusId, position: index, updatedAt: now }
      } else if (other.position !== index) {
        changed[other.id] = { ...other, position: index, updatedAt: now }
      }
    })

    set((current) => ({ tasks: { ...current.tasks, ...changed } }))
    return ok(get().tasks[taskId])
  },

  setCurrentUser(userId) {
    if (!get().users[userId]) return
    set({ currentUserId: userId })
  },
}))

/**
 * Reads the persisted workspace, if any, and marks the store ready.
 *
 * Stored data replaces the seed wholesale rather than merging: a partial
 * merge between two schema versions is how you end up with a half-migrated
 * store that no test covers.
 */
export async function hydrate(): Promise<void> {
  const stored = await loadState()
  useStore.setState({ ...(stored ?? {}), isReady: true })
}
