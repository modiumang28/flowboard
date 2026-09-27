import type { Container, Grant, User } from '../types'

/*
  Who can see and change what.

  These are pure functions over state, deliberately kept out of any component.
  The brief requires the checks to live in the store and its selectors rather
  than only in the UI, and this is also what makes them testable with nothing
  rendered — a test can ask "what can Bob see?" without mounting anything.
  Hiding a button is a courtesy; the store refusing is the actual rule.

  THE RULE, stated once:

    A container is reachable by a user if they are an admin, or if EVERY node
    on the path from the workspace down to it is individually permitted.

    A node is individually permitted when it is not archived, carries no deny
    grant for this user, and is either public or carries an explicit allow
    grant for this user.

  Two things fall out of that, and both are load-bearing:

    - Deny beats allow. A grant that says no wins over anything that says yes.
    - A hidden ancestor hides everything beneath it, however public those
      descendants are. Bob cannot see Q3 Features — which is public — because
      it sits inside the private Product space.

  EXTENDING THIS. Grants are per-user today. Teams would be the same table
  with a `subjectType` of 'user' | 'team' plus a team membership list; the
  resolution below would gather every grant whose subject the user matches,
  keeping deny-wins. Per-resource roles (viewer / editor / admin) would
  replace the allow|deny flag with a role, and the boolean helpers below would
  become a single `roleFor(user, container)` that walks the same path and
  takes the narrowest role found. Both changes are confined to this file.
*/

export interface PermissionState {
  containers: Record<string, Container>
  grants: Grant[]
  users: Record<string, User>
}

/** Deny wins if a user somehow holds both grants on the same container. */
function grantFor(
  grants: Grant[],
  resourceId: string,
  userId: string,
): Grant['mode'] | null {
  let found: Grant['mode'] | null = null
  for (const grant of grants) {
    if (grant.resourceId !== resourceId || grant.userId !== userId) continue
    if (grant.mode === 'deny') return 'deny'
    found = 'allow'
  }
  return found
}

/** Whether one node passes on its own, ignoring its ancestors. */
function nodePermits(state: PermissionState, node: Container, userId: string): boolean {
  if (node.archivedAt !== null) return false

  const grant = grantFor(state.grants, node.id, userId)
  if (grant === 'deny') return false
  if (node.visibility === 'private' && grant !== 'allow') return false

  return true
}

/**
 * Can this user reach this container, given everything above it in the tree?
 *
 * Archived nodes count as unreachable, so an archived ancestor hides its
 * subtree the same way a denied one does — callers get a single yes/no rather
 * than having to remember to check both.
 */
export function canViewContainer(
  state: PermissionState,
  userId: string,
  containerId: string,
): boolean {
  const user = state.users[userId]
  if (!user) return false
  if (user.role === 'admin') return true

  let node: Container | undefined = state.containers[containerId]
  if (!node) return false

  while (node) {
    if (!nodePermits(state, node, userId)) return false
    node = node.parentId ? state.containers[node.parentId] : undefined
  }

  return true
}

/**
 * Members may change tasks in any list they can reach.
 *
 * The brief promises exactly this and no more — "can edit tasks in those
 * lists" — so view and edit are the same question for tasks. A read-only role
 * would split them, which is why callers use this name rather than calling
 * canViewContainer directly.
 */
export function canEditTasksIn(
  state: PermissionState,
  userId: string,
  listId: string,
): boolean {
  return canViewContainer(state, userId, listId)
}

/**
 * Only admins may reshape the workspace — creating, renaming, deleting or
 * reordering containers.
 *
 * The brief grants members task editing and says nothing about structure, so
 * this is our line rather than theirs. It is recorded in the README.
 */
export function canManageContainers(state: PermissionState, userId: string): boolean {
  return state.users[userId]?.role === 'admin'
}

/** Every container this user can reach, unordered. Feed to buildTree. */
export function visibleContainers(state: PermissionState, userId: string): Container[] {
  return Object.values(state.containers).filter((container) =>
    canViewContainer(state, userId, container.id),
  )
}

/**
 * Why a list cannot be opened, so the UI can tell the two apart: a list that
 * does not exist is a broken link, one that is denied is a 403.
 */
export type ListAccess = 'ok' | 'forbidden' | 'not-found'

export function listAccess(
  state: PermissionState,
  userId: string,
  listId: string,
): ListAccess {
  const list = state.containers[listId]
  if (!list || list.type !== 'list') return 'not-found'
  // An archived list reads as gone rather than forbidden — it was deleted,
  // not withheld.
  if (list.archivedAt !== null) return 'not-found'
  return canViewContainer(state, userId, listId) ? 'ok' : 'forbidden'
}
