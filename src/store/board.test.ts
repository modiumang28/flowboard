import { describe, expect, it } from 'vitest'
import { seedStatuses, seedTasks } from '../data/seed'
import { buildBoard, resolveBoardDrop } from './board'

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

/*
  The drag gesture itself cannot be simulated — dnd-kit resolves drops by
  geometry and jsdom reports every element as 0x0 — so the decision it makes
  is pulled out here and tested directly. This is the function that answers
  both "where would the placeholder go" and "what happens on release", so the
  preview and the drop cannot disagree.
*/
describe('resolveBoardDrop', () => {
  const bugs = () => buildBoard(seedStatuses, seedTasks, 'list-bugs')
  // Bugs: Open [fix-crash, payment-retry] · Triaging [login-slow, avatar] · Fixed [typo]

  it('lands on the hovered card’s index', () => {
    // Dropping onto the second card in Open means taking its place.
    expect(resolveBoardDrop(bugs(), 'task-settings-typo', 'task-payment-retry')).toEqual({
      statusId: 'status-bugs-open',
      index: 1,
      sameColumn: false,
    })
  })

  it('lands at the end when dropped on a column’s empty space', () => {
    expect(resolveBoardDrop(bugs(), 'task-settings-typo', 'status-bugs-open')).toEqual({
      statusId: 'status-bugs-open',
      index: 2, // Open holds two cards
      sameColumn: false,
    })
  })

  it('flags a drag that has not left its column', () => {
    const drop = resolveBoardDrop(bugs(), 'task-fix-crash', 'task-payment-retry')
    expect(drop?.sameColumn).toBe(true)
  })

  it('flags a drag that crossed into another column', () => {
    const drop = resolveBoardDrop(bugs(), 'task-fix-crash', 'task-avatar-images')
    expect(drop).toEqual({
      statusId: 'status-bugs-triaging',
      index: 1,
      sameColumn: false,
    })
  })

  it('treats hovering the source column itself as staying put', () => {
    const drop = resolveBoardDrop(bugs(), 'task-fix-crash', 'status-bugs-open')
    expect(drop?.sameColumn).toBe(true)
  })

  it('resolves a card hovering over itself to its own column', () => {
    const drop = resolveBoardDrop(bugs(), 'task-fix-crash', 'task-fix-crash')
    expect(drop).toEqual({
      statusId: 'status-bugs-open',
      index: 0,
      sameColumn: true,
    })
  })

  it('can target an empty column', () => {
    // Q3 "Done" starts with no cards.
    const q3 = buildBoard(seedStatuses, seedTasks, 'list-q3-features')
    expect(resolveBoardDrop(q3, 'task-ratings-v2', 'status-q3-done')).toEqual({
      statusId: 'status-q3-done',
      index: 0,
      sameColumn: false,
    })
  })

  it('ignores a drag whose card is not on this board', () => {
    expect(resolveBoardDrop(bugs(), 'task-build-login', 'task-fix-crash')).toBeNull()
  })

  it('ignores an unknown drop target', () => {
    expect(resolveBoardDrop(bugs(), 'task-fix-crash', 'nope')).toBeNull()
  })

  it('never returns an index outside the target column', () => {
    for (const overId of [
      'task-fix-crash',
      'task-payment-retry',
      'status-bugs-open',
      'status-bugs-triaging',
      'status-bugs-fixed',
    ]) {
      const drop = resolveBoardDrop(bugs(), 'task-settings-typo', overId)
      if (!drop) continue
      const column = bugs().find((c) => c.status.id === drop.statusId)!
      expect(drop.index).toBeGreaterThanOrEqual(0)
      expect(drop.index).toBeLessThanOrEqual(column.tasks.length)
    }
  })

  it('agrees with where the placeholder is drawn', () => {
    // The preview suppresses the placeholder for same-column drags, and uses
    // the resolved index otherwise. Both read the same result.
    const across = resolveBoardDrop(bugs(), 'task-settings-typo', 'task-avatar-images')!
    const within = resolveBoardDrop(bugs(), 'task-fix-crash', 'task-payment-retry')!

    expect(across.sameColumn ? -1 : across.index).toBe(1)
    expect(within.sameColumn ? -1 : within.index).toBe(-1)
  })
})
