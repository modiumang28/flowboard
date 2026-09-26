import { describe, expect, it } from 'vitest'
import { VALID_PARENT_TYPE } from '../types'
import { seedContainers, seedGrants, seedStatuses, seedTasks, seedUsers } from './seed'

/*
  Integrity checks on the fixtures. These are not the permission tests the brief
  asks for — they guard the foundation everything else is built on, so that a
  mistyped id surfaces here rather than as a blank column three phases later.
*/

const byId = new Map(seedContainers.map((c) => [c.id, c]))
const statusById = new Map(seedStatuses.map((s) => [s.id, s]))
const userIds = new Set(seedUsers.map((u) => u.id))
const lists = seedContainers.filter((c) => c.type === 'list')

describe('seed counts match the brief', () => {
  it('has the required number of each entity', () => {
    const count = (type: string) => seedContainers.filter((c) => c.type === type).length
    expect(count('workspace')).toBe(1)
    expect(count('space')).toBe(2)
    expect(count('folder')).toBe(2)
    expect(count('list')).toBe(3)
    expect(seedUsers).toHaveLength(3)
    expect(seedGrants.length).toBeGreaterThan(0)
    expect(seedTasks.length).toBeGreaterThanOrEqual(15)
  })

  it('has exactly one admin', () => {
    expect(seedUsers.filter((u) => u.role === 'admin')).toHaveLength(1)
  })
})

describe('container tree is well formed', () => {
  it('has a single root, and it is the workspace', () => {
    const roots = seedContainers.filter((c) => c.parentId === null)
    expect(roots).toHaveLength(1)
    expect(roots[0].type).toBe('workspace')
  })

  it('only nests workspace -> space -> folder -> list', () => {
    for (const container of seedContainers) {
      const parent = container.parentId ? byId.get(container.parentId) : null
      expect(parent?.type ?? null).toBe(VALID_PARENT_TYPE[container.type])
    }
  })

  it('gives siblings a unique position', () => {
    const seen = new Set<string>()
    for (const container of seedContainers) {
      const key = `${container.parentId}:${container.position}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('statuses belong to lists', () => {
  it('points every status at a real list', () => {
    for (const status of seedStatuses) {
      expect(byId.get(status.listId)?.type).toBe('list')
    }
  })

  it('gives every list the three required categories', () => {
    for (const list of lists) {
      const categories = seedStatuses
        .filter((s) => s.listId === list.id)
        .map((s) => s.category)
      expect(categories).toEqual(expect.arrayContaining(['todo', 'active', 'done']))
    }
  })

  it('does not share status objects between lists', () => {
    const owners = new Set(seedStatuses.map((s) => s.listId))
    expect(owners.size).toBe(lists.length)
  })
})

describe('tasks reference valid entities', () => {
  it('lives in a real list', () => {
    for (const task of seedTasks) {
      expect(byId.get(task.primaryListId)?.type).toBe('list')
    }
  })

  it('uses a status owned by its own list', () => {
    for (const task of seedTasks) {
      const status = statusById.get(task.statusId)
      expect(status, `${task.id} has an unknown statusId`).toBeDefined()
      expect(status!.listId, `${task.id} uses a status from another list`).toBe(
        task.primaryListId,
      )
    }
  })

  it('only assigns real users', () => {
    for (const task of seedTasks) {
      for (const assigneeId of task.assigneeIds) {
        expect(userIds.has(assigneeId)).toBe(true)
      }
    }
  })

  it('gives tasks a unique position within their status column', () => {
    const seen = new Set<string>()
    for (const task of seedTasks) {
      const key = `${task.statusId}:${task.position}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('grants reference valid entities', () => {
  it('attaches only to a space, folder or list', () => {
    for (const grant of seedGrants) {
      const container = byId.get(grant.resourceId)
      expect(container).toBeDefined()
      expect(['space', 'folder', 'list']).toContain(container!.type)
    }
  })

  it('names real users', () => {
    for (const grant of seedGrants) {
      expect(userIds.has(grant.userId)).toBe(true)
    }
  })

  it('never gives one user both allow and deny on the same container', () => {
    const seen = new Set<string>()
    for (const grant of seedGrants) {
      const key = `${grant.resourceId}:${grant.userId}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('fixtures cover the UI states', () => {
  it('includes every priority', () => {
    const used = new Set(seedTasks.map((t) => t.priority))
    expect(used).toEqual(new Set(['urgent', 'high', 'normal', 'low', 'none']))
  })

  it('includes unassigned, multi-assignee, overdue and undated tasks', () => {
    expect(seedTasks.some((t) => t.assigneeIds.length === 0)).toBe(true)
    expect(seedTasks.some((t) => t.assigneeIds.length > 1)).toBe(true)
    expect(seedTasks.some((t) => t.dueDate === null)).toBe(true)
    expect(seedTasks.some((t) => t.dueDate !== null && t.dueDate < '2026-09-26')).toBe(true)
  })

  it('leaves at least one status column empty', () => {
    const used = new Set(seedTasks.map((t) => t.statusId))
    expect(seedStatuses.some((s) => !used.has(s.id))).toBe(true)
  })
})
