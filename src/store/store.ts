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
  type Container,
  type Grant,
  type Status,
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

export interface StoreActions {
  updateTask: (taskId: string, patch: TaskPatch) => Result<Task>
  moveTaskToList: (taskId: string, listId: string) => Result<Task>
  reorderTask: (taskId: string, toIndex: number) => Result<Task>
  setCurrentUser: (userId: string) => void
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

export function seededState(): StoreState {
  return {
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

export const useStore = create<StoreState & StoreActions>()((set, get) => ({
  ...(loadState() ?? seededState()),

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

  setCurrentUser(userId) {
    if (!get().users[userId]) return
    set({ currentUserId: userId })
  },
}))
