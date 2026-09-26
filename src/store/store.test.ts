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
