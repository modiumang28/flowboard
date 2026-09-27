import { beforeEach, describe, expect, it } from 'vitest'
import { isError } from '../lib/result'
import { MAX_TITLE_LENGTH } from '../types'
import { seededState, useStore } from './store'

/*
  The store exercised on its own, with no UI rendered — which is the point.
  These run in milliseconds and fail for exactly one reason.
*/

const store = () => useStore.getState()
const task = (id: string) => store().tasks[id]

beforeEach(() => {
  useStore.setState(seededState())
})

describe('createContainer', () => {
  it('creates a space under the workspace', () => {
    const result = store().createContainer('workspace-foodapp', 'space', 'Design')
    expect(isError(result)).toBe(false)
    if (!isError(result)) {
      expect(store().containers[result.data.id]).toMatchObject({
        name: 'Design',
        type: 'space',
        parentId: 'workspace-foodapp',
        visibility: 'public',
        archivedAt: null,
      })
    }
  })

  it('gives a new list its own default status set', () => {
    const result = store().createContainer('folder-mobile-app', 'list', 'Chores')
    expect(isError(result)).toBe(false)
    if (isError(result)) return

    const statuses = Object.values(store().statuses)
      .filter((s) => s.listId === result.data.id)
      .sort((a, b) => a.position - b.position)

    expect(statuses.map((s) => s.name)).toEqual(['To Do', 'In Progress', 'Done'])
    expect(statuses.map((s) => s.category)).toEqual(['todo', 'active', 'done'])
  })

  it('does not share status objects with any other list', () => {
    const result = store().createContainer('folder-mobile-app', 'list', 'Chores')
    if (isError(result)) throw new Error('setup failed')

    const ids = Object.values(store().statuses)
      .filter((s) => s.listId === result.data.id)
      .map((s) => s.id)
    const others = Object.values(store().statuses)
      .filter((s) => s.listId !== result.data.id)
      .map((s) => s.id)

    expect(ids.some((id) => others.includes(id))).toBe(false)
  })

  it('appends after existing siblings', () => {
    const result = store().createContainer('folder-mobile-app', 'list', 'Chores')
    if (isError(result)) throw new Error('setup failed')
    // Sprint 1 is 0 and Bugs is 1.
    expect(result.data.position).toBe(2)
  })

  it('refuses an invalid parent type', () => {
    const result = store().createContainer('workspace-foodapp', 'list', 'Nope')
    expect(result).toEqual({
      error: {
        code: 'INVALID_PARENT',
        message: 'A list cannot sit inside a workspace.',
      },
    })
  })

  it('refuses a container inside a list', () => {
    const result = store().createContainer('list-bugs', 'list', 'Nested')
    expect(isError(result) && result.error.code).toBe('INVALID_PARENT')
  })

  it('refuses an empty name', () => {
    const result = store().createContainer('workspace-foodapp', 'space', '   ')
    expect(isError(result) && result.error.code).toBe('VALIDATION')
  })

  it('refuses an unknown parent', () => {
    const result = store().createContainer('nope', 'space', 'Design')
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
  })
})

describe('renameContainer', () => {
  it('renames and trims', () => {
    store().renameContainer('list-bugs', '  Defects  ')
    expect(store().containers['list-bugs'].name).toBe('Defects')
  })

  it('refuses an empty name', () => {
    const result = store().renameContainer('list-bugs', '  ')
    expect(isError(result) && result.error.code).toBe('VALIDATION')
    expect(store().containers['list-bugs'].name).toBe('Bugs')
  })

  it('reports an unknown container as NOT_FOUND', () => {
    expect(isError(store().renameContainer('nope', 'X'))).toBe(true)
  })
})

describe('archiveContainer', () => {
  it('marks it archived without deleting it', () => {
    store().archiveContainer('list-bugs')
    expect(store().containers['list-bugs']).toBeDefined()
    expect(store().containers['list-bugs'].archivedAt).not.toBeNull()
  })

  it('leaves tasks in place, since this is a soft delete', () => {
    store().archiveContainer('list-bugs')
    expect(store().tasks['task-fix-crash']).toBeDefined()
  })

  it('closes the gap in its siblings', () => {
    store().archiveContainer('list-sprint-1')
    expect(store().containers['list-bugs'].position).toBe(0)
  })

  it('refuses to archive the workspace', () => {
    const result = store().archiveContainer('workspace-foodapp')
    expect(isError(result) && result.error.code).toBe('VALIDATION')
  })

  it('is a no-op when already archived', () => {
    store().archiveContainer('list-bugs')
    const first = store().containers['list-bugs'].archivedAt
    store().archiveContainer('list-bugs')
    expect(store().containers['list-bugs'].archivedAt).toBe(first)
  })
})

describe('reorderContainer', () => {
  const lists = () =>
    Object.values(store().containers)
      .filter((c) => c.parentId === 'folder-mobile-app' && c.archivedAt === null)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id)

  it('moves a sibling', () => {
    expect(lists()).toEqual(['list-sprint-1', 'list-bugs'])
    store().reorderContainer('list-bugs', 0)
    expect(lists()).toEqual(['list-bugs', 'list-sprint-1'])
  })

  it('keeps positions dense', () => {
    store().reorderContainer('list-bugs', 0)
    const positions = Object.values(store().containers)
      .filter((c) => c.parentId === 'folder-mobile-app')
      .map((c) => c.position)
      .sort((a, b) => a - b)
    expect(positions).toEqual([0, 1])
  })

  it('refuses to reorder the workspace', () => {
    const result = store().reorderContainer('workspace-foodapp', 0)
    expect(isError(result) && result.error.code).toBe('VALIDATION')
  })
})

describe('createTask', () => {
  const inColumn = (statusId: string) =>
    Object.values(store().tasks)
      .filter((t) => t.statusId === statusId)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.title)

  it('creates a task at the bottom of its column', () => {
    const result = store().createTask('list-sprint-1', {
      statusId: 'status-sprint-1-todo',
      title: 'Ship it',
    })

    expect(isError(result)).toBe(false)
    expect(inColumn('status-sprint-1-todo').at(-1)).toBe('Ship it')
  })

  it('fills the rest of the task with sensible empties', () => {
    const result = store().createTask('list-bugs', {
      statusId: 'status-bugs-open',
      title: 'Crash on load',
    })
    if (isError(result)) throw new Error('setup failed')

    expect(result.data).toMatchObject({
      description: '',
      priority: 'none',
      assigneeIds: [],
      dueDate: null,
      primaryListId: 'list-bugs',
      statusId: 'status-bugs-open',
    })
    expect(result.data.createdAt).toBe(result.data.updatedAt)
  })

  it('trims the title', () => {
    const result = store().createTask('list-bugs', {
      statusId: 'status-bugs-open',
      title: '  Padded  ',
    })
    expect(isError(result) ? null : result.data.title).toBe('Padded')
  })

  it('refuses an empty title', () => {
    const result = store().createTask('list-bugs', {
      statusId: 'status-bugs-open',
      title: '   ',
    })
    expect(result).toEqual({
      error: { code: 'VALIDATION', message: 'A task needs a title.' },
    })
  })

  it('refuses a title over the limit', () => {
    const result = store().createTask('list-bugs', {
      statusId: 'status-bugs-open',
      title: 'x'.repeat(MAX_TITLE_LENGTH + 1),
    })
    expect(isError(result) && result.error.code).toBe('VALIDATION')
  })

  it('refuses a status belonging to another list', () => {
    const result = store().createTask('list-bugs', {
      statusId: 'status-sprint-1-todo',
      title: 'Nope',
    })
    expect(result).toEqual({
      error: { code: 'VALIDATION', message: 'That status belongs to a different list.' },
    })
  })

  it('refuses a target that is not a list', () => {
    const result = store().createTask('folder-mobile-app', {
      statusId: 'status-bugs-open',
      title: 'Nope',
    })
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
  })

  it('refuses an archived list', () => {
    store().archiveContainer('list-bugs')
    const result = store().createTask('list-bugs', {
      statusId: 'status-bugs-open',
      title: 'Nope',
    })
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
  })

  it('gives each task a distinct id', () => {
    const a = store().createTask('list-bugs', {
      statusId: 'status-bugs-open',
      title: 'One',
    })
    const b = store().createTask('list-bugs', {
      statusId: 'status-bugs-open',
      title: 'Two',
    })
    expect(isError(a) || isError(b)).toBe(false)
    if (!isError(a) && !isError(b)) expect(a.data.id).not.toBe(b.data.id)
  })

  it('never leaves two tasks sharing a position', () => {
    store().createTask('list-bugs', { statusId: 'status-bugs-open', title: 'One' })
    store().createTask('list-bugs', { statusId: 'status-bugs-open', title: 'Two' })

    const seen = new Set<string>()
    for (const t of Object.values(store().tasks)) {
      const key = `${t.statusId}:${t.position}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('deleteTask', () => {
  it('removes the task outright', () => {
    const result = store().deleteTask('task-fix-crash')
    expect(isError(result)).toBe(false)
    expect(store().tasks['task-fix-crash']).toBeUndefined()
  })

  it('closes the gap in its column', () => {
    // Bugs / Open holds two tasks at positions 0 and 1.
    store().deleteTask('task-fix-crash')

    const positions = Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-bugs-open')
      .map((t) => t.position)
    expect(positions).toEqual([0])
  })

  it('leaves other columns alone', () => {
    const before = Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-bugs-triaging')
      .map((t) => `${t.id}:${t.position}`)
      .sort()

    store().deleteTask('task-fix-crash')

    const after = Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-bugs-triaging')
      .map((t) => `${t.id}:${t.position}`)
      .sort()
    expect(after).toEqual(before)
  })

  it('leaves containers and statuses untouched', () => {
    store().deleteTask('task-fix-crash')
    expect(store().containers['list-bugs']).toBeDefined()
    expect(store().statuses['status-bugs-open']).toBeDefined()
  })

  it('reports an unknown task as NOT_FOUND', () => {
    const result = store().deleteTask('task-nope')
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
  })
})

describe('updateTask', () => {
  it('applies a patch and bumps updatedAt', () => {
    const before = task('task-fix-crash').updatedAt
    const result = store().updateTask('task-fix-crash', { priority: 'low' })

    expect(isError(result)).toBe(false)
    expect(task('task-fix-crash').priority).toBe('low')
    expect(task('task-fix-crash').updatedAt).not.toBe(before)
  })

  it('leaves untouched fields alone', () => {
    store().updateTask('task-fix-crash', { priority: 'low' })
    expect(task('task-fix-crash').title).toBe('Fix crash on checkout')
    expect(task('task-fix-crash').assigneeIds).toEqual(['user-bob'])
  })

  it('trims the title', () => {
    store().updateTask('task-fix-crash', { title: '  Padded  ' })
    expect(task('task-fix-crash').title).toBe('Padded')
  })

  it('rejects an empty title', () => {
    const result = store().updateTask('task-fix-crash', { title: '   ' })
    expect(result).toEqual({
      error: { code: 'VALIDATION', message: 'A task needs a title.' },
    })
    expect(task('task-fix-crash').title).toBe('Fix crash on checkout')
  })

  it('rejects a title over the limit', () => {
    const result = store().updateTask('task-fix-crash', {
      title: 'x'.repeat(MAX_TITLE_LENGTH + 1),
    })
    expect(isError(result) && result.error.code).toBe('VALIDATION')
  })

  it('accepts a title exactly at the limit', () => {
    const result = store().updateTask('task-fix-crash', {
      title: 'x'.repeat(MAX_TITLE_LENGTH),
    })
    expect(isError(result)).toBe(false)
  })

  it('refuses a status belonging to another list', () => {
    // task-fix-crash is in Bugs; this status belongs to Sprint 1.
    const result = store().updateTask('task-fix-crash', {
      statusId: 'status-sprint-1-done',
    })
    expect(result).toEqual({
      error: { code: 'VALIDATION', message: 'That status belongs to a different list.' },
    })
    expect(task('task-fix-crash').statusId).toBe('status-bugs-open')
  })

  it('accepts a status from its own list', () => {
    const result = store().updateTask('task-fix-crash', { statusId: 'status-bugs-fixed' })
    expect(isError(result)).toBe(false)
    expect(task('task-fix-crash').statusId).toBe('status-bugs-fixed')
  })

  it('reports an unknown task as NOT_FOUND', () => {
    const result = store().updateTask('task-nope', { priority: 'low' })
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
  })

  it('refuses an unknown assignee', () => {
    const result = store().updateTask('task-fix-crash', { assigneeIds: ['user-nope'] })
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
  })

  it('returns the documented error shape', () => {
    const result = store().updateTask('task-nope', {})
    expect(isError(result)).toBe(true)
    if (isError(result)) {
      expect(Object.keys(result.error).sort()).toEqual(['code', 'message'])
      expect(typeof result.error.message).toBe('string')
    }
  })
})

describe('moveTaskToList', () => {
  it('moves the task and remaps the status by category', () => {
    // Bugs / Triaging (active) -> Sprint 1 / In Progress (active)
    const result = store().moveTaskToList('task-login-slow-network', 'list-sprint-1')

    expect(isError(result)).toBe(false)
    const moved = task('task-login-slow-network')
    expect(moved.primaryListId).toBe('list-sprint-1')
    expect(moved.statusId).toBe('status-sprint-1-progress')
  })

  it('always leaves the task on a status owned by its new list', () => {
    for (const listId of ['list-sprint-1', 'list-q3-features', 'list-bugs']) {
      store().moveTaskToList('task-fix-crash', listId)
      const moved = task('task-fix-crash')
      expect(store().statuses[moved.statusId].listId).toBe(moved.primaryListId)
    }
  })

  it('puts the task at the bottom of its new column', () => {
    store().moveTaskToList('task-fix-crash', 'list-sprint-1')
    const moved = task('task-fix-crash')

    const siblings = Object.values(store().tasks).filter(
      (t) => t.statusId === moved.statusId && t.id !== moved.id,
    )
    for (const sibling of siblings) {
      expect(moved.position).toBeGreaterThan(sibling.position)
    }
  })

  it('is a no-op when the task is already in that list', () => {
    const before = task('task-fix-crash')
    const result = store().moveTaskToList('task-fix-crash', 'list-bugs')

    expect(isError(result)).toBe(false)
    expect(task('task-fix-crash')).toEqual(before)
  })

  it('refuses a target that is not a list', () => {
    const result = store().moveTaskToList('task-fix-crash', 'folder-mobile-app')
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
    expect(task('task-fix-crash').primaryListId).toBe('list-bugs')
  })

  it('reports an unknown task as NOT_FOUND', () => {
    const result = store().moveTaskToList('task-nope', 'list-sprint-1')
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
  })
})

describe('reorderTask', () => {
  // Sprint 1 / To Do holds three tasks, positions 0, 1, 2.
  const column = () =>
    Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-sprint-1-todo')
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id)

  it('starts in seed order', () => {
    expect(column()).toEqual([
      'task-build-login',
      'task-checkout-flow',
      'task-analytics-events',
    ])
  })

  it('moves a task down', () => {
    store().reorderTask('task-build-login', 2)
    expect(column()).toEqual([
      'task-checkout-flow',
      'task-analytics-events',
      'task-build-login',
    ])
  })

  it('moves a task up', () => {
    store().reorderTask('task-analytics-events', 0)
    expect(column()).toEqual([
      'task-analytics-events',
      'task-build-login',
      'task-checkout-flow',
    ])
  })

  it('leaves positions dense and gap-free', () => {
    store().reorderTask('task-build-login', 2)
    const positions = Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-sprint-1-todo')
      .map((t) => t.position)
      .sort((a, b) => a - b)
    expect(positions).toEqual([0, 1, 2])
  })

  it('does not touch other columns', () => {
    const before = Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-sprint-1-progress')
      .map((t) => `${t.id}:${t.position}`)
      .sort()

    store().reorderTask('task-build-login', 2)

    const after = Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-sprint-1-progress')
      .map((t) => `${t.id}:${t.position}`)
      .sort()
    expect(after).toEqual(before)
  })

  it('clamps an out-of-range index', () => {
    store().reorderTask('task-build-login', 99)
    expect(column().at(-1)).toBe('task-build-login')
  })

  it('is a no-op when the index is unchanged', () => {
    const before = store().tasks['task-build-login']
    const result = store().reorderTask('task-build-login', 0)
    expect(isError(result)).toBe(false)
    expect(store().tasks['task-build-login']).toEqual(before)
  })

  it('reports an unknown task as NOT_FOUND', () => {
    const result = store().reorderTask('task-nope', 0)
    expect(isError(result) && result.error.code).toBe('NOT_FOUND')
  })
})

describe('moveTaskToStatus', () => {
  const inColumn = (statusId: string) =>
    Object.values(store().tasks)
      .filter((t) => t.statusId === statusId)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id)

  it('changes the status and lands at the requested index', () => {
    // Sprint 1: To Do -> In Progress, at the top.
    const result = store().moveTaskToStatus(
      'task-analytics-events',
      'status-sprint-1-progress',
      0,
    )

    expect(isError(result)).toBe(false)
    expect(task('task-analytics-events').statusId).toBe('status-sprint-1-progress')
    expect(inColumn('status-sprint-1-progress')[0]).toBe('task-analytics-events')
  })

  it('closes the gap in the column it left', () => {
    store().moveTaskToStatus('task-build-login', 'status-sprint-1-done', 0)

    const positions = Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-sprint-1-todo')
      .map((t) => t.position)
      .sort((a, b) => a - b)
    expect(positions).toEqual([0, 1])
  })

  it('renumbers the column it joined', () => {
    store().moveTaskToStatus('task-build-login', 'status-sprint-1-progress', 1)

    const positions = Object.values(store().tasks)
      .filter((t) => t.statusId === 'status-sprint-1-progress')
      .map((t) => t.position)
      .sort((a, b) => a - b)
    expect(positions).toEqual([0, 1, 2])
  })

  it('appends when the index is past the end', () => {
    store().moveTaskToStatus('task-build-login', 'status-sprint-1-progress', 99)
    expect(inColumn('status-sprint-1-progress').at(-1)).toBe('task-build-login')
  })

  it('drops into an empty column', () => {
    // Q3 "Done" starts empty.
    store().moveTaskToStatus('task-ratings-v2', 'status-q3-done', 0)
    expect(inColumn('status-q3-done')).toEqual(['task-ratings-v2'])
    expect(task('task-ratings-v2').position).toBe(0)
  })

  it('refuses a status from another list', () => {
    const result = store().moveTaskToStatus('task-build-login', 'status-bugs-open', 0)
    expect(result).toEqual({
      error: { code: 'VALIDATION', message: 'That status belongs to a different list.' },
    })
    expect(task('task-build-login').statusId).toBe('status-sprint-1-todo')
  })

  it('falls back to reordering when the status is unchanged', () => {
    store().moveTaskToStatus('task-build-login', 'status-sprint-1-todo', 2)
    expect(inColumn('status-sprint-1-todo').at(-1)).toBe('task-build-login')
  })

  it('never leaves two tasks sharing a position', () => {
    store().moveTaskToStatus('task-build-login', 'status-sprint-1-progress', 1)

    const seen = new Set<string>()
    for (const t of Object.values(store().tasks)) {
      const key = `${t.statusId}:${t.position}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('reports unknown ids as NOT_FOUND', () => {
    expect(
      isError(store().moveTaskToStatus('task-nope', 'status-sprint-1-todo', 0)),
    ).toBe(true)
    expect(isError(store().moveTaskToStatus('task-build-login', 'status-nope', 0))).toBe(
      true,
    )
  })
})

describe('setCurrentUser', () => {
  it('switches the current user', () => {
    store().setCurrentUser('user-bob')
    expect(store().currentUserId).toBe('user-bob')
  })

  it('ignores an unknown user', () => {
    store().setCurrentUser('user-nope')
    expect(store().currentUserId).toBe('user-alice')
  })
})
