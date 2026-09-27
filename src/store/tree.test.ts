import { beforeEach, describe, expect, it } from 'vitest'
import { seedContainers } from '../data/seed'
import type { Container } from '../types'
import { ancestorsOf, buildTree, collectIds } from './tree'

let containers: Record<string, Container>

beforeEach(() => {
  containers = Object.fromEntries(seedContainers.map((c) => [c.id, { ...c }]))
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
