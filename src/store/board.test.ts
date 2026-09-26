import { describe, expect, it } from 'vitest'
import { seedStatuses, seedTasks } from '../data/seed'
import { buildBoard } from './board'

describe('buildBoard', () => {
  it('returns only the statuses owned by that list', () => {
    const names = buildBoard(seedStatuses, seedTasks, 'list-bugs').map(
      (c) => c.status.name,
    )
    expect(names).toEqual(['Open', 'Triaging', 'Fixed'])
  })

  it('gives a different list a different column set', () => {
    const names = buildBoard(seedStatuses, seedTasks, 'list-sprint-1').map(
      (c) => c.status.name,
    )
    expect(names).toEqual(['To Do', 'In Progress', 'Done'])
  })

  it('orders columns by position', () => {
    const positions = buildBoard(seedStatuses, seedTasks, 'list-q3-features').map(
      (c) => c.status.position,
    )
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('places every task in its own column, in position order', () => {
    for (const { status, tasks } of buildBoard(
      seedStatuses,
      seedTasks,
      'list-sprint-1',
    )) {
      expect(tasks.every((t) => t.statusId === status.id)).toBe(true)
      expect(tasks.map((t) => t.position)).toEqual(
        [...tasks.map((t) => t.position)].sort((a, b) => a - b),
      )
    }
  })

  it('never leaks tasks from another list', () => {
    const board = buildBoard(seedStatuses, seedTasks, 'list-bugs')
    const ids = board.flatMap((c) => c.tasks.map((t) => t.primaryListId))
    expect(new Set(ids)).toEqual(new Set(['list-bugs']))
  })

  it('keeps a column with no tasks rather than dropping it', () => {
    const board = buildBoard(seedStatuses, seedTasks, 'list-q3-features')
    expect(board).toHaveLength(3)
    expect(board.some((c) => c.tasks.length === 0)).toBe(true)
  })

  it('returns no columns for an unknown list', () => {
    expect(buildBoard(seedStatuses, seedTasks, 'list-nope')).toEqual([])
  })
})
