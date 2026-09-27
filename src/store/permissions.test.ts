import { beforeEach, describe, expect, it } from 'vitest'
import { isError } from '../lib/result'
import type { Container, Grant, User } from '../types'
import {
  canEditTasksIn,
  canManageContainers,
  canViewContainer,
  listAccess,
  visibleContainers,
  type PermissionState,
} from './permissions'
import { seededState, useStore } from './store'
import { buildTree, collectIds } from './tree'

/*
  The permission rules, exercised with nothing rendered. That is the point of
  the exercise as much as the coverage: if these could not be written without
  mounting a component, the checks would be living in the UI.

  Seed grants under test:
    Bugs         deny  Bob
    Sprint 1     deny  Carol
    Product      allow Carol   (Product is the only private container)
*/

let state: PermissionState

beforeEach(() => {
  useStore.setState(seededState())
  const { containers, grants, users } = useStore.getState()
  state = { containers, grants, users }
})

const visibleIds = (userId: string) =>
  new Set(visibleContainers(state, userId).map((c) => c.id))

const withGrant = (grant: Grant): PermissionState => ({
  ...state,
  grants: [...state.grants, grant],
})

describe('the tree an admin sees', () => {
  it('includes everything, private containers included', () => {
    expect(visibleIds('user-alice').size).toBe(Object.keys(state.containers).length)
    expect(canViewContainer(state, 'user-alice', 'space-product')).toBe(true)
  })

  it('ignores a deny grant aimed at them', () => {
    const denied = withGrant({
      resourceId: 'list-bugs',
      userId: 'user-alice',
      mode: 'deny',
    })
    expect(canViewContainer(denied, 'user-alice', 'list-bugs')).toBe(true)
  })
})

describe('the tree Bob sees', () => {
  it('drops the list he is denied', () => {
    expect(canViewContainer(state, 'user-bob', 'list-bugs')).toBe(false)
    expect(visibleIds('user-bob').has('list-bugs')).toBe(false)
  })

  it('drops a private space he has no grant for', () => {
    expect(canViewContainer(state, 'user-bob', 'space-product')).toBe(false)
  })

  it('drops public descendants of a space he cannot see', () => {
    // Roadmap and Q3 Features are both public. They are unreachable only
    // because Product, their ancestor, is private.
    expect(state.containers['folder-roadmap'].visibility).toBe('public')
    expect(state.containers['list-q3-features'].visibility).toBe('public')

    expect(canViewContainer(state, 'user-bob', 'folder-roadmap')).toBe(false)
    expect(canViewContainer(state, 'user-bob', 'list-q3-features')).toBe(false)
  })

  it('keeps the branch he does have', () => {
    for (const id of [
      'workspace-foodapp',
      'space-engineering',
      'folder-mobile-app',
      'list-sprint-1',
    ]) {
      expect(canViewContainer(state, 'user-bob', id)).toBe(true)
    }
  })

  it('leaves him exactly one list', () => {
    const lists = visibleContainers(state, 'user-bob').filter((c) => c.type === 'list')
    expect(lists.map((c) => c.name)).toEqual(['Sprint 1'])
  })
})

describe('the tree Carol sees', () => {
  it('lets her into the private space she was granted', () => {
    expect(canViewContainer(state, 'user-carol', 'space-product')).toBe(true)
    expect(canViewContainer(state, 'user-carol', 'list-q3-features')).toBe(true)
  })

  it('still denies the list she is denied', () => {
    expect(canViewContainer(state, 'user-carol', 'list-sprint-1')).toBe(false)
  })

  it('differs from Bob, which is the whole point of two members', () => {
    const bob = visibleIds('user-bob')
    const carol = visibleIds('user-carol')
    expect(carol).not.toEqual(bob)
    expect(carol.has('list-bugs')).toBe(true)
    expect(bob.has('list-bugs')).toBe(false)
  })

  it('leaves her a different pair of lists', () => {
    const lists = visibleContainers(state, 'user-carol')
      .filter((c) => c.type === 'list')
      .map((c) => c.name)
      .sort()
    expect(lists).toEqual(['Bugs', 'Q3 Features'])
  })
})

describe('how the rules resolve', () => {
  it('lets deny beat allow on the same container', () => {
    const both = withGrant({
      resourceId: 'space-product',
      userId: 'user-carol',
      mode: 'deny',
    })
    expect(canViewContainer(both, 'user-carol', 'space-product')).toBe(false)
  })

  it('treats public as visible without any grant', () => {
    expect(canViewContainer(state, 'user-bob', 'space-engineering')).toBe(true)
  })

  it('treats private as hidden without an allow grant', () => {
    expect(canViewContainer(state, 'user-bob', 'space-product')).toBe(false)
  })

  it('hides an archived node and its subtree', () => {
    const archived: PermissionState = {
      ...state,
      containers: {
        ...state.containers,
        'space-engineering': {
          ...state.containers['space-engineering'],
          archivedAt: '2026-09-27T00:00:00.000Z',
        } as Container,
      },
    }
    expect(canViewContainer(archived, 'user-bob', 'space-engineering')).toBe(false)
    expect(canViewContainer(archived, 'user-bob', 'list-sprint-1')).toBe(false)
  })

  it('refuses an unknown user and an unknown container', () => {
    expect(canViewContainer(state, 'user-nobody', 'list-sprint-1')).toBe(false)
    expect(canViewContainer(state, 'user-bob', 'nope')).toBe(false)
  })
})

describe('the tree selector, not just the rule', () => {
  const treeIds = (userId: string) => {
    const tree = buildTree(visibleContainers(state, userId))
    return tree ? collectIds(tree) : []
  }

  it('gives each user a different tree', () => {
    expect(treeIds('user-alice')).toHaveLength(8)
    expect(treeIds('user-bob')).toEqual([
      'workspace-foodapp',
      'space-engineering',
      'folder-mobile-app',
      'list-sprint-1',
    ])
  })

  it('never returns a node whose parent was filtered out', () => {
    const ids = new Set(treeIds('user-bob'))
    for (const id of ids) {
      const parentId = state.containers[id].parentId
      if (parentId) expect(ids.has(parentId)).toBe(true)
    }
  })
})

describe('task access', () => {
  it('lets a member edit tasks in a list they can reach', () => {
    expect(canEditTasksIn(state, 'user-bob', 'list-sprint-1')).toBe(true)
  })

  it('refuses tasks in a list they cannot reach', () => {
    expect(canEditTasksIn(state, 'user-bob', 'list-bugs')).toBe(false)
    expect(canEditTasksIn(state, 'user-carol', 'list-sprint-1')).toBe(false)
  })

  it('lets an admin edit tasks anywhere', () => {
    for (const id of ['list-sprint-1', 'list-bugs', 'list-q3-features']) {
      expect(canEditTasksIn(state, 'user-alice', id)).toBe(true)
    }
  })
})

describe('managing the workspace structure', () => {
  it('is allowed for an admin only', () => {
    expect(canManageContainers(state, 'user-alice')).toBe(true)
    expect(canManageContainers(state, 'user-bob')).toBe(false)
    expect(canManageContainers(state, 'user-carol')).toBe(false)
  })
})

describe('listAccess', () => {
  it('separates denied from missing', () => {
    expect(listAccess(state, 'user-bob', 'list-sprint-1')).toBe('ok')
    expect(listAccess(state, 'user-bob', 'list-bugs')).toBe('forbidden')
    expect(listAccess(state, 'user-bob', 'nope')).toBe('not-found')
  })

  it('reports a non-list container as missing, not forbidden', () => {
    expect(listAccess(state, 'user-alice', 'folder-mobile-app')).toBe('not-found')
  })

  it('reports an archived list as gone rather than withheld', () => {
    useStore.getState().archiveContainer('list-bugs')
    const next = useStore.getState()
    expect(listAccess(next, 'user-alice', 'list-bugs')).toBe('not-found')
  })
})

/*
  The rules above are only half of the requirement. The store must refuse a
  denied mutation on its own, so that hiding a control is a courtesy rather
  than the actual guard.
*/
describe('the store refuses denied mutations', () => {
  const asUser = (userId: string) => useStore.getState().setCurrentUser(userId)
  const store = () => useStore.getState()

  it('refuses a task edit in a denied list, with the documented shape', () => {
    asUser('user-bob')
    const result = store().updateTask('task-fix-crash', { priority: 'low' })

    expect(result).toEqual({
      error: { code: 'FORBIDDEN', message: 'You do not have access to that list.' },
    })
    expect(store().tasks['task-fix-crash'].priority).toBe('urgent')
  })

  it('refuses creating, deleting and reordering in a denied list', () => {
    asUser('user-bob')
    const denied = [
      store().createTask('list-bugs', { title: 'Nope', statusId: 'status-bugs-open' }),
      store().deleteTask('task-fix-crash'),
      store().reorderTask('task-fix-crash', 0),
      store().moveTaskToStatus('task-fix-crash', 'status-bugs-fixed', 0),
    ]
    for (const result of denied) {
      expect(isError(result) && result.error.code).toBe('FORBIDDEN')
    }
    expect(store().tasks['task-fix-crash']).toBeDefined()
  })

  it('refuses a move when only the destination is denied', () => {
    // Carol may touch Bugs but not Sprint 1.
    asUser('user-carol')
    const result = store().moveTaskToList('task-fix-crash', 'list-sprint-1')

    expect(isError(result) && result.error.code).toBe('FORBIDDEN')
    expect(store().tasks['task-fix-crash'].primaryListId).toBe('list-bugs')
  })

  it('allows a member to edit tasks in a list they can reach', () => {
    asUser('user-bob')
    const result = store().updateTask('task-build-login', { priority: 'low' })

    expect(isError(result)).toBe(false)
    expect(store().tasks['task-build-login'].priority).toBe('low')
  })

  it('refuses every structural change for a member', () => {
    asUser('user-bob')
    const denied = [
      store().createContainer('space-engineering', 'folder', 'Nope'),
      store().renameContainer('list-sprint-1', 'Renamed'),
      store().archiveContainer('list-sprint-1'),
      store().reorderContainer('list-sprint-1', 1),
    ]
    for (const result of denied) {
      expect(isError(result) && result.error.code).toBe('FORBIDDEN')
    }
    expect(store().containers['list-sprint-1'].name).toBe('Sprint 1')
  })

  it('allows an admin everything a member was refused', () => {
    asUser('user-alice')
    expect(isError(store().updateTask('task-fix-crash', { priority: 'low' }))).toBe(false)
    expect(isError(store().renameContainer('list-bugs', 'Defects'))).toBe(false)
  })

  it('changes what is allowed the moment the user switches', () => {
    asUser('user-bob')
    expect(isError(store().updateTask('task-fix-crash', { priority: 'low' }))).toBe(true)

    asUser('user-alice')
    expect(isError(store().updateTask('task-fix-crash', { priority: 'low' }))).toBe(false)
  })
})

describe('grants only attach to containers', () => {
  it('has no effect when pointed at a task', () => {
    const odd: PermissionState = {
      ...state,
      grants: [
        ...state.grants,
        { resourceId: 'task-build-login', userId: 'user-bob', mode: 'deny' },
      ],
    }
    // Tasks inherit from their list; a grant on a task id is simply not read.
    expect(canEditTasksIn(odd, 'user-bob', 'list-sprint-1')).toBe(true)
  })

  it('treats a user with no grants as an ordinary member', () => {
    const stranger: User = {
      id: 'user-dave',
      name: 'Dave',
      role: 'member',
      avatarColor: 'slate',
    }
    const withDave: PermissionState = {
      ...state,
      users: { ...state.users, 'user-dave': stranger },
    }
    // Everything public, nothing private.
    expect(canViewContainer(withDave, 'user-dave', 'list-bugs')).toBe(true)
    expect(canViewContainer(withDave, 'user-dave', 'space-product')).toBe(false)
  })
})
