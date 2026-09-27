import { describe, expect, it } from 'vitest'
import { seedStatuses, seedTasks } from '../data/seed'
import { PRIORITY_RANK } from '../types'
import { buildTaskList } from './list'

const rows = (listId: string, sort?: Parameters<typeof buildTaskList>[3]) =>
  buildTaskList(seedStatuses, seedTasks, listId, sort)

describe('buildTaskList — scope', () => {
  it('returns only that list’s tasks', () => {
    const lists = new Set(rows('list-bugs').map((r) => r.task.primaryListId))
    expect(lists).toEqual(new Set(['list-bugs']))
    expect(rows('list-bugs')).toHaveLength(5)
  })

  it('pairs each task with its own status', () => {
    for (const { task, status } of rows('list-bugs')) {
      expect(status.id).toBe(task.statusId)
      expect(status.listId).toBe(task.primaryListId)
    }
  })

  it('returns nothing for an unknown list', () => {
    expect(rows('list-nope')).toEqual([])
  })
})

describe('buildTaskList — default order', () => {
  it('matches board order: by status column, then position', () => {
    const order = rows('list-sprint-1').map((r) => r.task.id)
    expect(order).toEqual([
      // To Do
      'task-build-login',
      'task-checkout-flow',
      'task-analytics-events',
      // In Progress
      'task-build-home',
      'task-push-notifications',
      // Done
      'task-project-scaffold',
    ])
  })
})

describe('buildTaskList — sort by priority', () => {
  it('puts urgent first, not alphabetical', () => {
    const order = rows('list-sprint-1', { key: 'priority', direction: 'asc' }).map(
      (r) => r.task.priority,
    )
    const ranks = order.map((p) => PRIORITY_RANK[p])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(order[0]).toBe('urgent')
  })

  it('reverses, putting none first', () => {
    const order = rows('list-sprint-1', { key: 'priority', direction: 'desc' }).map(
      (r) => r.task.priority,
    )
    expect(order[0]).toBe('none')
  })
})

describe('buildTaskList — sort by due date', () => {
  it('puts the earliest date first', () => {
    const dates = rows('list-sprint-1', { key: 'due', direction: 'asc' })
      .map((r) => r.task.dueDate)
      .filter((d): d is string => d !== null)
    expect(dates).toEqual([...dates].sort())
  })

  it('keeps undated tasks last when ascending', () => {
    const dates = rows('list-sprint-1', { key: 'due', direction: 'asc' }).map(
      (r) => r.task.dueDate,
    )
    const firstNull = dates.indexOf(null)
    expect(firstNull).toBeGreaterThan(-1)
    expect(dates.slice(firstNull).every((d) => d === null)).toBe(true)
  })

  it('keeps undated tasks last when descending too', () => {
    const dates = rows('list-sprint-1', { key: 'due', direction: 'desc' }).map(
      (r) => r.task.dueDate,
    )
    const firstNull = dates.indexOf(null)
    expect(dates.slice(firstNull).every((d) => d === null)).toBe(true)
  })

  it('reverses the dated tasks', () => {
    const asc = rows('list-sprint-1', { key: 'due', direction: 'asc' })
      .map((r) => r.task.dueDate)
      .filter(Boolean)
    const desc = rows('list-sprint-1', { key: 'due', direction: 'desc' })
      .map((r) => r.task.dueDate)
      .filter(Boolean)
    expect(desc).toEqual([...asc].reverse())
  })
})

describe('buildTaskList — stability', () => {
  it('never drops or duplicates a task when sorting', () => {
    const base = rows('list-sprint-1')
      .map((r) => r.task.id)
      .sort()
    for (const sort of [
      { key: 'priority', direction: 'asc' },
      { key: 'priority', direction: 'desc' },
      { key: 'due', direction: 'asc' },
      { key: 'due', direction: 'desc' },
    ] as const) {
      expect(
        rows('list-sprint-1', sort)
          .map((r) => r.task.id)
          .sort(),
      ).toEqual(base)
    }
  })
})
