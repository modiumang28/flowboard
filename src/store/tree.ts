import type { Container } from '../types'

/*
  Containers are stored flat. The nested shape the sidebar needs is built here,
  on read, and never stored — so switching user or archiving something is just
  a matter of running this again over a different input.
*/

export interface TreeNode {
  container: Container
  depth: number
  children: TreeNode[]
}

/**
 * Nests a flat container list into a tree, dropping archived nodes and sorting
 * siblings by position. Returns null when there is no visible root.
 *
 * Archiving cascades: a node whose parent was dropped is never reached, so its
 * whole subtree disappears with it.
 */
export function buildTree(containers: Container[]): TreeNode | null {
  const live = containers.filter((c) => c.archivedAt === null)

  const childrenByParent = new Map<string, Container[]>()
  let root: Container | undefined

  for (const container of live) {
    if (container.parentId === null) {
      root = container
      continue
    }
    const siblings = childrenByParent.get(container.parentId)
    if (siblings) siblings.push(container)
    else childrenByParent.set(container.parentId, [container])
  }

  if (!root) return null

  const attach = (container: Container, depth: number): TreeNode => ({
    container,
    depth,
    children: (childrenByParent.get(container.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((child) => attach(child, depth + 1)),
  })

  return attach(root, 0)
}

/** Every container id in the tree, for expanding the sidebar by default. */
export function collectIds(node: TreeNode): string[] {
  return [node.container.id, ...node.children.flatMap(collectIds)]
}

/**
 * Where a sidebar drag should land, or null if the drop is not a valid
 * sibling reorder.
 *
 * Only siblings may be reordered. The brief asks for sibling ordering, not
 * re-parenting — and a move to a different parent would also have to satisfy
 * workspace -> space -> folder -> list, so a cross-parent drop is refused
 * rather than guessed at.
 */
export function resolveSiblingDrop(
  containers: Record<string, Container>,
  activeId: string,
  overId: string,
): { containerId: string; toIndex: number } | null {
  if (activeId === overId) return null

  const moved = containers[activeId]
  const target = containers[overId]
  if (!moved || !target) return null
  if (moved.parentId === null || moved.parentId !== target.parentId) return null

  const siblings = Object.values(containers)
    .filter(
      (container) =>
        container.parentId === moved.parentId && container.archivedAt === null,
    )
    .sort((a, b) => a.position - b.position)

  const toIndex = siblings.findIndex((container) => container.id === overId)
  return toIndex === -1 ? null : { containerId: activeId, toIndex }
}

/**
 * The path from the workspace down to a container, inclusive — the breadcrumb.
 * Returns an empty array when the id is unknown.
 */
export function ancestorsOf(
  containers: Record<string, Container>,
  containerId: string,
): Container[] {
  const path: Container[] = []
  let current: Container | undefined = containers[containerId]

  while (current) {
    path.unshift(current)
    current = current.parentId ? containers[current.parentId] : undefined
  }

  return path
}
