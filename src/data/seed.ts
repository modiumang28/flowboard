import type { Container, Grant, Status, Task, User } from '../types'

/*
  Seed fixtures. The brief asks for exactly 1 workspace, 2 spaces, 2 folders,
  3 lists, 15+ tasks, 3 users and sample grants.

  FoodApp (workspace)
  ├── Engineering            space   public
  │   └── Mobile App         folder
  │       ├── Sprint 1       list    To Do / In Progress / Done
  │       └── Bugs           list    Open / Triaging / Fixed
  └── Product                space   PRIVATE
      └── Roadmap            folder
          └── Q3 Features    list    To Do / In Progress / Done

  Two things are arranged deliberately:

  1. Bugs uses a different status set from the other two lists. That is the
     visible proof that status sets are owned per-list rather than global.

  2. The grants give all three users a different view, so the permission
     difference is obvious within seconds of switching user:
       Alice (admin)  Sprint 1, Bugs, Q3 Features   — bypasses everything
       Bob            Sprint 1                       — denied Bugs; Product is private
       Carol          Bugs, Q3 Features              — denied Sprint 1; allowed into Product

  Ids are readable rather than random so that tests and debugging stay legible.
  Entities created at runtime use crypto.randomUUID().
*/

const CREATED = '2026-09-14T09:00:00.000Z'
const UPDATED = '2026-09-24T11:30:00.000Z'

// ------------------------------------------------------------------- users

export const seedUsers: User[] = [
  { id: 'user-alice', name: 'Alice Chen', role: 'admin', avatarColor: 'blue' },
  { id: 'user-bob', name: 'Bob Martinez', role: 'member', avatarColor: 'green' },
  { id: 'user-carol', name: 'Carol Singh', role: 'member', avatarColor: 'amber' },
]

export const DEFAULT_USER_ID = 'user-alice'

// -------------------------------------------------------------- containers

export const seedContainers: Container[] = [
  {
    id: 'workspace-foodapp',
    name: 'FoodApp',
    type: 'workspace',
    parentId: null,
    position: 0,
    visibility: 'public',
    archivedAt: null,
  },

  // --- Engineering branch (public) ---
  {
    id: 'space-engineering',
    name: 'Engineering',
    type: 'space',
    parentId: 'workspace-foodapp',
    position: 0,
    visibility: 'public',
    archivedAt: null,
  },
  {
    id: 'folder-mobile-app',
    name: 'Mobile App',
    type: 'folder',
    parentId: 'space-engineering',
    position: 0,
    visibility: 'public',
    archivedAt: null,
  },
  {
    id: 'list-sprint-1',
    name: 'Sprint 1',
    type: 'list',
    parentId: 'folder-mobile-app',
    position: 0,
    visibility: 'public',
    archivedAt: null,
  },
  {
    id: 'list-bugs',
    name: 'Bugs',
    type: 'list',
    parentId: 'folder-mobile-app',
    position: 1,
    visibility: 'public',
    archivedAt: null,
  },

  // --- Product branch (private: needs an explicit allow grant) ---
  {
    id: 'space-product',
    name: 'Product',
    type: 'space',
    parentId: 'workspace-foodapp',
    position: 1,
    visibility: 'private',
    archivedAt: null,
  },
  {
    id: 'folder-roadmap',
    name: 'Roadmap',
    type: 'folder',
    parentId: 'space-product',
    position: 0,
    visibility: 'public',
    archivedAt: null,
  },
  {
    id: 'list-q3-features',
    name: 'Q3 Features',
    type: 'list',
    parentId: 'folder-roadmap',
    position: 0,
    visibility: 'public',
    archivedAt: null,
  },
]

// ---------------------------------------------------------------- statuses

export const seedStatuses: Status[] = [
  // Sprint 1
  {
    id: 'status-sprint-1-todo',
    listId: 'list-sprint-1',
    name: 'To Do',
    category: 'todo',
    color: 'slate',
    position: 0,
  },
  {
    id: 'status-sprint-1-progress',
    listId: 'list-sprint-1',
    name: 'In Progress',
    category: 'active',
    color: 'blue',
    position: 1,
  },
  {
    id: 'status-sprint-1-done',
    listId: 'list-sprint-1',
    name: 'Done',
    category: 'done',
    color: 'green',
    position: 2,
  },

  // Bugs — deliberately different names from the other two lists
  {
    id: 'status-bugs-open',
    listId: 'list-bugs',
    name: 'Open',
    category: 'todo',
    color: 'red',
    position: 0,
  },
  {
    id: 'status-bugs-triaging',
    listId: 'list-bugs',
    name: 'Triaging',
    category: 'active',
    color: 'amber',
    position: 1,
  },
  {
    id: 'status-bugs-fixed',
    listId: 'list-bugs',
    name: 'Fixed',
    category: 'done',
    color: 'green',
    position: 2,
  },

  // Q3 Features
  {
    id: 'status-q3-todo',
    listId: 'list-q3-features',
    name: 'To Do',
    category: 'todo',
    color: 'slate',
    position: 0,
  },
  {
    id: 'status-q3-progress',
    listId: 'list-q3-features',
    name: 'In Progress',
    category: 'active',
    color: 'blue',
    position: 1,
  },
  {
    id: 'status-q3-done',
    listId: 'list-q3-features',
    name: 'Done',
    category: 'done',
    color: 'green',
    position: 2,
  },
]

// ------------------------------------------------------------------- tasks

/*
  16 tasks. Spread deliberately so the UI states are all reachable without
  setup: every priority appears, three tasks are unassigned, two have multiple
  assignees, two are overdue, and the Q3 "Done" column is empty so the empty
  column state is visible on first load.
*/
export const seedTasks: Task[] = [
  // ---- Sprint 1 · To Do ----
  {
    id: 'task-build-login',
    title: 'Build login screen',
    description: 'Email and password, plus the "forgot password" link.',
    primaryListId: 'list-sprint-1',
    statusId: 'status-sprint-1-todo',
    priority: 'high',
    assigneeIds: ['user-alice'],
    dueDate: '2026-10-05T17:00:00.000Z',
    position: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'task-checkout-flow',
    title: 'Add checkout flow',
    description: 'Cart summary, address picker, and payment step.',
    primaryListId: 'list-sprint-1',
    statusId: 'status-sprint-1-todo',
    priority: 'normal',
    assigneeIds: ['user-bob', 'user-alice'],
    dueDate: null,
    position: 1,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'task-analytics-events',
    title: 'Set up analytics events',
    description: '',
    primaryListId: 'list-sprint-1',
    statusId: 'status-sprint-1-todo',
    priority: 'low',
    assigneeIds: [],
    dueDate: null,
    position: 2,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  // ---- Sprint 1 · In Progress ----
  {
    id: 'task-build-home',
    title: 'Build home screen',
    description: 'Restaurant carousel, search bar, and recent orders.',
    primaryListId: 'list-sprint-1',
    statusId: 'status-sprint-1-progress',
    priority: 'urgent',
    assigneeIds: ['user-bob'],
    dueDate: '2026-09-24T17:00:00.000Z', // overdue
    position: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'task-push-notifications',
    title: 'Wire up push notifications',
    description: 'Order status updates only for now.',
    primaryListId: 'list-sprint-1',
    statusId: 'status-sprint-1-progress',
    priority: 'normal',
    assigneeIds: ['user-carol'],
    dueDate: '2026-10-10T17:00:00.000Z',
    position: 1,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  // ---- Sprint 1 · Done ----
  {
    id: 'task-project-scaffold',
    title: 'Project scaffold and CI',
    description: '',
    primaryListId: 'list-sprint-1',
    statusId: 'status-sprint-1-done',
    priority: 'none',
    assigneeIds: ['user-alice'],
    dueDate: null,
    position: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  // ---- Bugs · Open ----
  {
    id: 'task-fix-crash',
    title: 'Fix crash on checkout',
    description: 'Happens on iOS 17 when the cart is empty.',
    primaryListId: 'list-bugs',
    statusId: 'status-bugs-open',
    priority: 'urgent',
    assigneeIds: ['user-bob'],
    dueDate: '2026-09-28T17:00:00.000Z',
    position: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'task-payment-retry',
    title: 'Payment retry loops forever',
    description: 'Declined cards trigger an infinite retry.',
    primaryListId: 'list-bugs',
    statusId: 'status-bugs-open',
    priority: 'high',
    assigneeIds: [],
    dueDate: '2026-10-01T17:00:00.000Z',
    position: 1,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  // ---- Bugs · Triaging ----
  {
    id: 'task-login-slow-network',
    title: 'Login fails on slow networks',
    description: 'Request times out at 5s; needs a longer timeout and a retry.',
    primaryListId: 'list-bugs',
    statusId: 'status-bugs-triaging',
    priority: 'high',
    assigneeIds: ['user-carol'],
    dueDate: '2026-09-22T17:00:00.000Z', // overdue
    position: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'task-avatar-images',
    title: 'Avatar images not loading',
    description: '',
    primaryListId: 'list-bugs',
    statusId: 'status-bugs-triaging',
    priority: 'low',
    assigneeIds: ['user-bob'],
    dueDate: null,
    position: 1,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  // ---- Bugs · Fixed ----
  {
    id: 'task-settings-typo',
    title: 'Typo on the settings page',
    description: '"Notifcations" should be "Notifications".',
    primaryListId: 'list-bugs',
    statusId: 'status-bugs-fixed',
    priority: 'none',
    assigneeIds: ['user-alice'],
    dueDate: null,
    position: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  // ---- Q3 Features · To Do ----
  {
    id: 'task-loyalty-program',
    title: 'Loyalty program',
    description: 'Points per order, redeemable against delivery fees.',
    primaryListId: 'list-q3-features',
    statusId: 'status-q3-todo',
    priority: 'high',
    assigneeIds: ['user-alice', 'user-carol'],
    dueDate: '2026-11-15T17:00:00.000Z',
    position: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'task-recommendations',
    title: 'Personalised recommendations',
    description: 'Based on previous orders and time of day.',
    primaryListId: 'list-q3-features',
    statusId: 'status-q3-todo',
    priority: 'normal',
    assigneeIds: ['user-carol'],
    dueDate: null,
    position: 1,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'task-group-ordering',
    title: 'Group ordering',
    description: '',
    primaryListId: 'list-q3-features',
    statusId: 'status-q3-todo',
    priority: 'low',
    assigneeIds: [],
    dueDate: null,
    position: 2,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  // ---- Q3 Features · In Progress ----
  {
    id: 'task-ratings-v2',
    title: 'Restaurant ratings v2',
    description: 'Split ratings into food, delivery and packaging.',
    primaryListId: 'list-q3-features',
    statusId: 'status-q3-progress',
    priority: 'urgent',
    assigneeIds: ['user-alice'],
    dueDate: '2026-10-08T17:00:00.000Z',
    position: 0,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },
  {
    id: 'task-saved-addresses',
    title: 'Saved addresses',
    description: 'Let people label and reuse delivery addresses.',
    primaryListId: 'list-q3-features',
    statusId: 'status-q3-progress',
    priority: 'normal',
    assigneeIds: ['user-carol'],
    dueDate: '2026-10-20T17:00:00.000Z',
    position: 1,
    createdAt: CREATED,
    updatedAt: UPDATED,
  },

  // Q3 Features · Done is intentionally empty — it exercises the empty-column state.
]

// ------------------------------------------------------------------ grants

/*
  Only two combinations do any work: `deny` on a public container, and `allow`
  on a private one. Each user ends up with a different view of the tree.
*/
export const seedGrants: Grant[] = [
  { resourceId: 'list-bugs', userId: 'user-bob', mode: 'deny' },
  { resourceId: 'list-sprint-1', userId: 'user-carol', mode: 'deny' },
  { resourceId: 'space-product', userId: 'user-carol', mode: 'allow' },
]
