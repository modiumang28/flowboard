# Flowboard

A mini project-management app for a single workspace — hierarchy, kanban board, list
view, and a permission model — built with no backend.

> **Status: in progress.** Phase 0 (project setup and design decisions) is complete.
> Sections marked _TODO_ will be filled in as the app is built.

---

## Running locally

```bash
npm install
npm run dev
```

| Command              | What it does                       |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start the dev server               |
| `npm run build`      | Typecheck and build for production |
| `npm test`           | Run the test suite once            |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run lint`       | Lint the project                   |

---

## Stack

| Area          | Choice                                      |
| ------------- | ------------------------------------------- |
| Framework     | React 18.3.1 + TypeScript                   |
| Build         | Vite                                        |
| State         | Zustand                                     |
| Routing       | React Router                                |
| Styling       | Tailwind CSS v4                             |
| Components    | Headless UI                                 |
| Icons         | Lucide                                      |
| Drag and drop | dnd-kit                                     |
| Persistence   | localStorage (versioned, behind an adapter) |
| Testing       | Vitest + React Testing Library              |

---

## Design decisions

These are the choices worth explaining — what was picked, what it was picked over,
and why.

### Zustand over Redux Toolkit

The brief requires mutations to return a consistent error shape:

```
{ error: { code, message } }
```

That is a **return value**. Redux's write path is `dispatch(action)`, and `dispatch`
does not return a result — it accepts an action and returns it. To get an error back
to the caller I would have had to either park the error in state (a different shape
from the one the brief asked for, and racy when two callers fail at once) or wrap
every mutation in a thunk purely to borrow its return channel — which means adding
async machinery to an app that has no async in it at all.

Zustand actions are plain functions, so they return a `Result<T>` naturally.

Redux's real strengths — middleware, time-travel, a serialisable action log — are
coordination tools for large teams and complex async. This is a solo, synchronous,
three-day app, so none of them are load-bearing here.

**Where Redux would have won:** the optional activity-feed stretch goal ("Alice moved
task X to Done") is essentially a log of dispatched actions, which Redux gives you for
free. That feature is out of scope, so the argument does not apply — but it is the
case where I would have reconsidered.

### Permission checks live in the store, not in components

The brief is explicit that permission checks must not live only in the UI. Two
consequences shaped the architecture:

- **Selectors filter.** Anything that reads data out of the store (the tree, a
  board, a task list) returns only what the current user may see.
- **Actions reject.** Any mutation on a resource the user may not touch returns
  `{ error: { code: 'FORBIDDEN', … } }` rather than silently doing nothing.

Hiding a button is cosmetic — the underlying operation still exists. Since the store
is standing in for a server here, it inherits the server's job of actually saying no.

A useful side effect: because the rules live in the store, they can be tested with no
UI rendered at all. Those tests are the evidence that the rule was followed — if the
logic were tangled into the sidebar, the tests could not be written that way.

### localStorage for persistence, behind an adapter

**Why persist at all:** moving a task and then losing it on refresh reads as broken.
The brief treats product feel as part of the MVP, and durability is part of that. It
also removes any ambiguity from the requirement that status and position "persist
after drop".

**How it is wired:** persistence is a _subscriber_ to the store, not a step inside
each action. One watcher reacts to state changes and writes; the twenty-odd mutations
know nothing about storage. The alternative — calling `save()` at the end of every
action — means one forgotten call produces a bug where most changes persist and one
does not, which looks intermittent and is miserable to find.

The adapter exposes exactly two functions, `load()` and `save()`. That is the same
shape an API client would have.

**What is persisted:** entities only — containers, tasks, statuses, grants, and the
current user. Never UI state. Restoring a half-open drawer on refresh would be worse
than not persisting at all.

**Trade-offs accepted:**

- The stored data carries a schema version. If it does not match, the app discards it
  and reseeds. Without this, changing a type mid-build leaves stale data in a shape
  the app can no longer read.
- Once localStorage has data, the seed path stops running — yet an empty browser is
  the only way a reviewer will ever open the app. Cold start is therefore tested
  deliberately rather than assumed.

**To reset to the seeded demo data:** clear localStorage for this origin in devtools.
I kept that as a documented step rather than a button, to keep demo tooling out of the
product surface.

**How this would extend to a real backend:** the store, selectors, actions, and
components never learn where data lives, so they would survive unchanged. The adapter
itself would need real work, though — `save(everything)` is fine locally but wrong
over a network, so it would become per-operation endpoints, plus failure handling and
some way to stay in sync with other users. Most importantly, the permission checks
would move to the server: client-side checks are not security, and the client copy
would become a UI hint only.

### React Router, rather than keeping the selection in the store

The selected list lives in the URL (`/list/:listId`) instead of in Zustand.

The deciding reason is a requirement that is otherwise impossible to demonstrate. The
brief asks that _"attempting to open or mutate a denied resource shows a clear error"_.
If a list can only be selected by clicking the sidebar, and the sidebar never shows
Bob a list he cannot see, then Bob can never _attempt_ to open one — so the 403 state
has no way to appear. With URLs, navigating directly to a forbidden list id renders a
proper access-denied view.

Secondary benefits: refresh keeps you on the list you were viewing (which matters
once data is persisted — persisting the data but not the selection feels
inconsistent), the back button behaves, and list links are shareable.

### Tailwind v4, and a deliberately small token set

**v4 over v3:** v4 needs no `tailwind.config.js` and no PostCSS config, so there is
less to set up and less to explain. It also exposes every token as a real CSS
variable, which is useful because status colours are stored as data and sometimes
need to be applied dynamically.

**On the "no custom CSS" rule:** `src/index.css` is the only stylesheet. It contains
an `@import` and a `@theme` block — design tokens, i.e. configuration — and no style
rules. Every version of Tailwind requires one CSS entry point, so the rule cannot mean
"no CSS files"; it means no hand-written style rules, and there are none. All layout
and theming is utility classes in TSX.

**Why the token set is small:** the brief asks for a _small_ token set and grades
consistency rather than richness. Fourteen tokens total:

- One brand colour, one page surface, one border colour
- **Five accents shared between priority levels and status categories.** Priority
  and status do not have separate palettes — `urgent` and an `open` status are the
  same red. Fewer values, and the app reads as one system.
- Each accent does double duty for text and badge background via an opacity
  modifier (`text-accent-red` + `bg-accent-red/10`), so badges are consistent by
  construction rather than by vigilance.
- One font, two radii, three shadows.

`shadow-drag` is deliberately the heaviest shadow in the set: it is what makes a
dragged card read as picked up, which the brief requires.

Plain text uses Tailwind's built-in slate scale rather than custom tokens — no reason
to redefine something the framework already provides well.

### Errors are returned, not thrown

The brief allows either. Returning a `Result<T>` makes failure part of each
function's type signature, so a caller cannot forget to handle it, and tests can
assert on the exact error shape. Throwing would make the failure path invisible to
the type system.

Error codes are a closed set: `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`,
`INVALID_PARENT`. See `src/lib/result.ts`.

### Flat, normalised state — the tree is derived, never stored

Containers, tasks, statuses and users are stored as `Record<id, Entity>` maps rather
than as a nested tree. The tree shape is built by a selector on read.

Nested storage would make three common operations awkward: reordering a sibling
(splicing a nested array rather than changing one number), filtering by permission
(recursive pruning rather than one filter pass), and looking an entity up by id.

### Component and icon libraries

**Headless UI** ships behaviour and accessibility with no styling, so it cannot
conflict with the Tailwind-only rule — and the brief names it as an acceptable
choice. It is used mainly for the task drawer, where "sensible focus behaviour" means
focus moving into the dialog, being trapped inside it, and returning to the trigger on
close, plus Escape handling, overlay clicks, ARIA roles and scroll locking. That is a
lot of fiddly work to hand-roll, and focus restore is the part people usually get
wrong.

**Lucide** for icons, purely so that the chevrons, container-type icons and action
icons share one visual family rather than drifting in weight and size.

**Dates** use the browser's built-in `Intl` rather than a date library — no reason to
add a dependency for something the platform does.

### Testing scope

The brief asks for a minimum: store tests for permission filtering, plus at least one
component or E2E test.

- **Permission tests run against the store with no UI rendered.** That is the point —
  they double as proof that permission logic lives in the data layer.
- **One component test** covers the user switcher end to end: render as Alice, switch
  to Bob, assert the tree shrinks. It proves the whole chain is wired up — seed →
  store → permission rules → selector → rendered output — which the unit tests
  deliberately do not cover.
- **No E2E.** The brief says "component test **or** E2E". The component test gives the
  same coverage of the critical path for a fraction of the setup cost.
- Drag and drop is not unit tested — simulating pointer sequences is expensive and
  brittle, and the budget is better spent elsewhere.

---

## Architecture

_TODO — diagram of components and store._

## Data model

Five entities, all stored flat as `Record<id, Entity>` maps. See `src/types/`.

```
Container ─ parentId ──► Container        workspace → space → folder → list
Status    ─ listId ────► Container        each list owns its own status set
Task      ─ primaryListId ──► Container   the list it lives in
          ─ statusId ──────► Status       must belong to primaryListId
          ─ assigneeIds ───► User[]
Grant     ─ resourceId ──► Container      a space, folder or list
          ─ userId ──────► User
```

### Containers are one shape, not four

Workspace, space, folder and list share a single `Container` interface with a
`type` discriminator, because they share every field. Nesting is constrained by
`VALID_PARENT_TYPE`, enforced on create and move. Lists are the leaves of the
container tree — they hold tasks, never other containers.

### Tasks are not tree nodes

Containers point at containers via `parentId`; a task points at its list via
`primaryListId`. The names are deliberately different so that tree-walking code
cannot accidentally recurse into tasks.

### Statuses are owned per list, and `category` is why that works

Each list has its own status objects — Bugs uses _Open / Triaging / Fixed_ while
Sprint 1 uses _To Do / In Progress / Done_. Nothing is shared between lists.

`name` is what a person reads; `category` (`todo` | `active` | `done`) is what
the code reads. The names differ per list but the three meanings do not, so
`category` is the only thing that can connect a status in one list to its
equivalent in another.

That matters when a task moves between lists. Its old `statusId` points at a
status the destination board never renders, so the task would silently vanish.
The move therefore resolves a new status by matching `category`, and changes
`primaryListId` and `statusId` together — they are two halves of one fact.

### References, not copies

A task stores `statusId`, not the status; `assigneeIds`, not the people. Each
fact is written down once, so a renamed column or user cannot leave stale copies
scattered across tasks. Views resolve the ids on read.

### Two invariants the store protects

1. A task's `statusId` must point at a `Status` whose `listId` equals the task's
   `primaryListId`.
2. A container's `parentId` must satisfy `VALID_PARENT_TYPE`.

### Deviations from the brief's field tables

| Added                  | Why                                                          |
| ---------------------- | ------------------------------------------------------------ |
| `Container.visibility` | Section 5 needs public vs private; section 1 never stores it |
| `Container.archivedAt` | Section 1 asks for soft-delete/archive but not how           |
| `Task.id`              | Omitted from their table                                     |
| `Task.primaryListId`   | Named in the operations list, absent from the table          |
| `Status.listId`        | "Each list owns a status set" — the link is never specified  |
| `User`                 | Described only in prose; the shape is ours                   |

`Task.status` is named **`statusId`**, because it holds a reference rather than a
value — the brief itself says it must "map to" a status.

### Ids

Seed entities use readable ids (`list-bugs`, `status-bugs-triaging`) so tests and
debugging stay legible. Anything created at runtime uses `crypto.randomUUID()`.

### Seed fixtures

`src/data/seed.ts` builds 1 workspace, 2 spaces, 2 folders, 3 lists, 16 tasks,
3 users and 3 grants.

Two things are arranged deliberately. **Bugs uses a different status set** from
the other two lists, which is the visible proof that status sets are per-list
rather than global. And **the grants give all three users a different view**, so
the permission difference is obvious immediately:

| User           | Sees                        | Why                                     |
| -------------- | --------------------------- | --------------------------------------- |
| Alice (admin)  | Sprint 1, Bugs, Q3 Features | bypasses visibility and grants entirely |
| Bob (member)   | Sprint 1                    | denied Bugs; Product is private         |
| Carol (member) | Bugs, Q3 Features           | denied Sprint 1; allowed into Product   |

The fixtures also cover the UI states without any setup: every priority appears,
three tasks are unassigned, two have several assignees, two are overdue, and the
Q3 "Done" column is empty so the empty-column state shows on first load.

`src/data/seed.test.ts` asserts the fixtures are internally consistent — parent
types, status ownership, dangling ids, duplicate positions. These are not the
permission tests the brief asks for; they exist so a mistyped id fails loudly
here rather than as a blank column three phases later.

## How permissions are enforced

All of the rules live in `src/store/permissions.ts` as pure functions over
state. Nothing in a component decides access; components only render what a
selector hands them, and mutations are refused by the store whether or not the
UI bothered to hide the control.

### The rule

> A container is reachable by a user if they are an **admin**, or if **every**
> node on the path from the workspace down to it is individually permitted.
>
> A node is individually permitted when it is not archived, carries no `deny`
> grant for that user, and is either `public` or carries an explicit `allow`
> grant for that user.

Two consequences fall out, and both are load-bearing:

- **Deny beats allow.** A grant saying no wins over anything saying yes.
- **A hidden ancestor hides its whole subtree**, however public the
  descendants are.

### The three users, worked through

Grants in the seed: `deny Bob → Bugs`, `deny Carol → Sprint 1`,
`allow Carol → Product`. Product is the only private container.

| Container             | Alice (admin) | Bob                  | Carol          |
| --------------------- | ------------- | -------------------- | -------------- |
| Engineering (public)  | ✅            | ✅                   | ✅             |
| Sprint 1 (public)     | ✅            | ✅                   | ❌ denied      |
| Bugs (public)         | ✅            | ❌ denied            | ✅             |
| **Product (private)** | ✅ bypass     | ❌ no allow grant    | ✅ allow grant |
| Roadmap (public)      | ✅            | ❌ _ancestor hidden_ | ✅             |
| Q3 Features (public)  | ✅            | ❌ _ancestor hidden_ | ✅             |

Roadmap and Q3 Features are the interesting rows: both are public and neither
carries a grant, yet Bob cannot reach either, because Product above them is
private. That cascade is not special-cased anywhere — it falls out of the path
walk, and of filtering the tree _before_ nesting it rather than after.

### Where each check sits

| Surface        | What happens                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar tree   | `visibleContainers()` filters, then `buildTree()` nests. A dropped parent is never recursed into, so its children simply never appear.                                                      |
| Opening a list | The route resolves `listAccess()` and renders a 403 view. "Denied" and "does not exist" are kept distinct.                                                                                  |
| Task drawer    | A task is resolved **through** the permission check, not by id. `?task=` is guessable, so an unchecked lookup would leak a denied task's title and assignees through an allowed list's URL. |
| Breadcrumb     | Suppressed for an unreachable list — it names every ancestor, which would describe a private space the user is not meant to know exists.                                                    |
| Every mutation | Returns `{ error: { code: 'FORBIDDEN', … } }`. Task actions check the list the task lives in; a move checks **both** ends, so a task cannot be pushed into a list the user cannot see.      |

### Members versus admins

The brief promises members exactly one thing — "can edit tasks in those lists"
— and says nothing about structure. So the line drawn here is:

- **Tasks:** any member may create, edit, move, reorder and delete tasks in a
  list they can reach. View and edit are the same question; a read-only role
  would be the thing that splits them.
- **Containers:** admin only. Creating, renaming, deleting, and reordering the
  tree are all refused for members, and the corresponding controls are hidden.

### Why the tests are the evidence

`src/store/permissions.test.ts` asks "what can Bob see?" with **nothing
rendered**. That is only possible because the rules are not in a component —
if they were, the question could not be asked without mounting the sidebar.
`src/features/shell/UserSwitcher.test.tsx` covers the other half: that
switching user immediately changes the tree, the board and the breadcrumb.

### Extending the model

The brief explicitly does not ask for team grants or richer roles. Both would
be confined to `permissions.ts`:

- **Teams.** Same grant table with a `subjectType` of `'user' | 'team'` plus a
  membership list. Resolution gathers every grant whose subject matches the
  user, keeping deny-wins. The path walk is unchanged.
- **Per-resource roles.** Replace the `allow | deny` flag with a role
  (`viewer` / `editor` / `admin`). The boolean helpers collapse into one
  `roleFor(user, container)` that walks the same path and keeps the narrowest
  role it finds. `canEditTasksIn` then stops being an alias for
  `canViewContainer`, which is the point.
- **A real backend.** These checks move to the server. The client copy stays as
  a UI hint only — client-side checks are not security, they just save a
  round trip and stop the interface offering what will be refused.

## Trade-offs and what I would do next

### Cut on purpose

| Cut                                       | Reasoning                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All stretch goals**                     | The brief caps them at two and says to ship a working MVP over half-finished extras. Decided up front so the choice was not relitigated mid-build. |
| **Subtasks**                              | Explicitly "stretch within MVP". `parentTaskId` is not on the model.                                                                               |
| **Status editing UI**                     | The brief requires lists to _own_ status sets, not that users can edit them. Sets are seeded and fixed.                                            |
| **Simulated pagination**                  | Explicitly optional, and paginating in-memory data adds complexity with no visible payoff at 16 tasks.                                             |
| **`createdAt`/`updatedAt` on containers** | Only required on tasks.                                                                                                                            |
| **E2E tests**                             | The brief says "component test **or** E2E". The component test covers the critical path for far less setup.                                        |

_TODO — week 2._

## AI usage

_TODO — see `AI_USAGE.md`._

## Drag-and-drop `style=` exceptions

_TODO — dnd-kit requires inline transforms on draggables; will be listed here._
