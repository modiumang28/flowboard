import { beforeEach, describe, expect, it } from 'vitest'
import { seedContainers } from '../data/seed'
import type { Container } from '../types'
import { ancestorsOf, buildTree, collectIds, resolveSiblingDrop } from './tree'

const byId = (containers: Container[]) =>
  Object.fromEntries(containers.map((c) => [c.id, c]))

let containers: Record<string, Container>

beforeEach(() => {
  containers = byId(seedContainers.map((c) => ({ ...c })))
})

describe('buildTree', () => {
  it('nests from the workspace down', () => {
    const tree = buildTree(Object.values(containers))
    expect(tree?.container.id).toBe('workspace-foodapp')
    expect(tree?.children.map((c) => c.container.name)).toEqual([
      'Engineering',
      'Product',
    ])
  })

  it('sorts siblings by position', () => {
    const tree = buildTree(Object.values(containers))
    const mobileApp = tree!.children[0].children[0]
    expect(mobileApp.children.map((c) => c.container.name)).toEqual(['Sprint 1', 'Bugs'])
  })

  it('drops archived nodes and their whole subtree', () => {
    containers['space-product'] = {
      ...containers['space-product'],
      archivedAt: '2026-09-27T00:00:00.000Z',
    }
    const ids = collectIds(buildTree(Object.values(containers))!)

    expect(ids).not.toContain('space-product')
    // Roadmap and Q3 Features are public, but unreachable without their parent.
    expect(ids).not.toContain('folder-roadmap')
    expect(ids).not.toContain('list-q3-features')
    expect(ids).toContain('list-sprint-1')
  })

  it('returns null when there is no root', () => {
    expect(buildTree([])).toBeNull()
  })
})

describe('ancestorsOf', () => {
  it('returns the path from the workspace down, inclusive', () => {
    expect(ancestorsOf(containers, 'list-bugs').map((c) => c.name)).toEqual([
      'FoodApp',
      'Engineering',
      'Mobile App',
      'Bugs',
    ])
  })

  it('returns just the workspace for the root', () => {
    expect(ancestorsOf(containers, 'workspace-foodapp')).toHaveLength(1)
  })

  it('returns nothing for an unknown id', () => {
    expect(ancestorsOf(containers, 'nope')).toEqual([])
  })
})

describe('resolveSiblingDrop', () => {
  it('resolves a drop onto a sibling to that sibling’s index', () => {
    // Sprint 1 (0) and Bugs (1) share the Mobile App folder.
    expect(resolveSiblingDrop(containers, 'list-bugs', 'list-sprint-1')).toEqual({
      containerId: 'list-bugs',
      toIndex: 0,
    })
  })

  it('refuses a drop onto a different parent’s child', () => {
    // Bugs lives under Mobile App; Q3 Features under Roadmap.
    expect(resolveSiblingDrop(containers, 'list-bugs', 'list-q3-features')).toBeNull()
  })

  it('refuses a drop onto a node at another level', () => {
    expect(resolveSiblingDrop(containers, 'list-bugs', 'space-engineering')).toBeNull()
  })

  it('refuses dragging the workspace, which has no siblings', () => {
    expect(
      resolveSiblingDrop(containers, 'workspace-foodapp', 'space-engineering'),
    ).toBeNull()
  })

  it('refuses a drop onto itself', () => {
    expect(resolveSiblingDrop(containers, 'list-bugs', 'list-bugs')).toBeNull()
  })

  it('refuses unknown ids', () => {
    expect(resolveSiblingDrop(containers, 'nope', 'list-bugs')).toBeNull()
    expect(resolveSiblingDrop(containers, 'list-bugs', 'nope')).toBeNull()
  })

  it('indexes against visible siblings only, skipping archived ones', () => {
    containers['list-sprint-1'] = {
      ...containers['list-sprint-1'],
      archivedAt: '2026-09-27T00:00:00.000Z',
    }
    // Bugs is now the only visible child, so dropping onto it lands at 0.
    expect(resolveSiblingDrop(containers, 'list-bugs', 'list-sprint-1')).toBeNull()
  })
})
