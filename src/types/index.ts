/*
  The five domain entities.

  Two deviations from the brief's field tables, both forced by other
  requirements, and both noted in the README:
    - Container gains `visibility` (section 5 needs public vs private) and
      `archivedAt` (section 1 asks for soft-delete).
    - Task's `status` is named `statusId`, because it holds a reference rather
      than a value. Task also gains `id` and `primaryListId`, which the brief
      names in prose but omits from its table.
*/

/** Mirrors the five accent tokens in the Tailwind theme. */
export type AccentColor = 'red' | 'amber' | 'blue' | 'green' | 'slate'

// ---------------------------------------------------------------- containers

export type ContainerType = 'workspace' | 'space' | 'folder' | 'list'

/** One shape for all four tree levels. Lists hold tasks, never containers. */
export interface Container {
  id: string
  name: string
  type: ContainerType
  /** null only for the workspace. */
  parentId: string | null
  /** Order among siblings, not across the whole tree. */
  position: number
  /** The default rule for everyone; Grants are per-user exceptions to it. */
  visibility: 'public' | 'private'
  /** ISO datetime, or null when not archived. */
  archivedAt: string | null
}

/** Enforced on create and move: which parent type each node may sit under. */
export const VALID_PARENT_TYPE: Record<ContainerType, ContainerType | null> = {
  workspace: null,
  space: 'workspace',
  folder: 'space',
  list: 'folder',
}

// ----------------------------------------------------------------- statuses

/**
 * The meaning behind a status name. Names are per-list and arbitrary ("Open",
 * "To Do", "Draft"); the category is the shared vocabulary that lets a task
 * moving between lists land in the equivalent column.
 */
export type StatusCategory = 'todo' | 'active' | 'done'

/** Owned by exactly one list. Two lists never share a status object. */
export interface Status {
  id: string
  listId: string
  /** What the user reads on the column header. */
  name: string
  category: StatusCategory
  color: AccentColor
  /** Left-to-right column order within the list. */
  position: number
}

// -------------------------------------------------------------------- tasks

export type Priority = 'urgent' | 'high' | 'normal' | 'low' | 'none'

export const PRIORITIES: readonly Priority[] = ['urgent', 'high', 'normal', 'low', 'none']

/** Sort order for the list view — alphabetical would be meaningless. */
export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
  none: 4,
}

export const MAX_TITLE_LENGTH = 500

export interface Task {
  id: string
  /** Capped at MAX_TITLE_LENGTH; validated in the store. */
  title: string
  /** "" rather than undefined, so readers never need a null check. */
  description: string
  primaryListId: string
  /**
   * Must point at a Status whose listId equals primaryListId. Moving a task
   * between lists changes both fields together, matching on category.
   */
  statusId: string
  priority: Priority
  assigneeIds: string[]
  /** ISO datetime, or null when undated. */
  dueDate: string | null
  /** Order within its status column. */
  position: number
  createdAt: string
  updatedAt: string
}

// -------------------------------------------------------------------- users

export type Role = 'admin' | 'member'

export interface User {
  id: string
  /** Shown in the switcher, and reduced to initials on task cards. */
  name: string
  /** Admins bypass every visibility rule and grant. */
  role: Role
  avatarColor: AccentColor
}

// ------------------------------------------------------------------- grants

/**
 * A per-user exception on one container. `deny` is only meaningful on public
 * containers, `allow` only on private ones; the other two combinations are
 * no-ops. When a user somehow has both on the same container, deny wins.
 */
export interface Grant {
  /** A Container id — space, folder, or list. Never the workspace or a task. */
  resourceId: string
  userId: string
  mode: 'allow' | 'deny'
}
