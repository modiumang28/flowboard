# Flowboard

A mini project-management app for a single workspace — a container hierarchy,
a kanban board, a list view, and a permission model — with no backend. State
lives in a typed client store seeded from fixtures.

**Live demo:** [flowboard-modiumang28.vercel.app](https://flowboard-modiumang28.vercel.app)

---

## 1. Running locally

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
| `npm run lint`       | Lint                               |
| `npm run format`     | Format with Prettier               |

**To reset to the seeded demo data:** clear `localStorage` for the origin in
devtools. That is a documented step rather than a button, to keep demo tooling
out of the product surface.

---

## 2. Architecture

| Area          | Choice                                     |
| ------------- | ------------------------------------------ |
| Framework     | React 18 + TypeScript, Vite                |
| State         | Zustand                                    |
| Routing       | React Router                               |
| Styling       | Tailwind CSS v4                            |
| Components    | Headless UI (headless, Tailwind-friendly)  |
| Drag and drop | dnd-kit                                    |
| Persistence   | localStorage, versioned, behind an adapter |
| Testing       | Vitest + React Testing Library             |

```
┌──────────────────────────────────────────────────────────────────────┐
│  COMPONENTS                                                          │
│                                                                      │
│   Sidebar           TopBar               main content                │
│    └ TreeNodeRow     ├ UserSwitcher       ├ Board                    │
│                      ├ ViewToggle         │  └ BoardColumn           │
│                      └ CreateTaskDialog   │     └ SortableTaskCard   │
│                                           ├ TaskTable                │
│   Toaster ─ errors with nowhere else to go└ TaskDrawer               │
└──────────┬─────────────────────────────────────────────┬─────────────┘
           │ read                                        │ write
           │ (selectors — filtered by permission)        │ (actions)
           ▼                                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  store/                                                              │
│                                                                      │
│   SELECTORS · pure functions, no React                               │
│     permissions.ts   canViewContainer · visibleContainers            │
│     tree.ts          buildTree · ancestorsOf · resolveSiblingDrop    │
│     board.ts         buildBoard · statusesForList                    │
│     list.ts          buildTaskList  (sorting)                        │
│                                                                      │
│   STATE · flat and normalised, keyed by id                           │
│     containers · statuses · tasks · users · grants                   │
│     currentUserId · isReady                                          │
│                                                                      │
│   ACTIONS · every one returns Result<T>, never throws                │
│     container CRUD · task CRUD · moves · reorders                    │
│     ↳ each checks permissions before it touches state                │
└──────────┬───────────────────────────────────────────────────────────┘
           │ subscribes to every change
           ▼
   persistence.ts ── load() / save() ──► localStorage
```

Three properties hold this together.

**Data flows one way.** Components never mutate state; they call an action and
render what a selector returns. Selectors are pure functions that take state
and give back a shape — the tree, a board, a sorted table — so they can be
tested with nothing mounted.

**The store is the only writer.** That single chokepoint is what makes the
permission checks enforceable. If components could edit state directly there
would be nowhere to put them.

**Persistence is a subscriber, not a step.** One watcher reacts to state
changes and writes; the actions know nothing about storage. Calling `save()`
at the end of each action would mean one forgotten call produces a bug where
most changes persist and one does not — which looks intermittent and is
miserable to find.

### Why Zustand rather than Redux Toolkit

The brief asks mutations to return `{ error: { code, message } }`. That is a
**return value**, and Redux's write path is `dispatch(action)`, which returns
the action rather than a result. Getting an error back to the caller would
have meant either parking it in state (a different shape from the one asked
for, and racy when two callers fail at once) or wrapping every mutation in a
thunk purely to borrow its return channel — adding async machinery to an app
with no async in it. Zustand actions are plain functions, so a `Result<T>`
falls out naturally.

Redux's real strengths — middleware, time travel, a serialisable action log —
are coordination tools for large teams and complex async. The one place it
would have won here is the optional activity-feed stretch goal, which is
essentially a log of dispatched actions; that feature is out of scope.

### Why the selection lives in the URL

`/list/:listId?view=list&sort=due&task=…` rather than in the store.

The deciding reason is a requirement that is otherwise impossible to
demonstrate: _"attempting to open or mutate a denied resource shows a clear
error"_. If a list can only be selected by clicking the sidebar, and the
sidebar never shows Bob a list he cannot see, Bob can never **attempt** to
open one — so the 403 has no way to appear. With URLs, pasting a forbidden
list id renders a proper access-denied view.

Secondary benefits: refresh keeps you where you were, which matters once data
is persisted; the back button works; links are shareable.

### Errors are returned, not thrown

The brief allows either. Returning a `Result<T>` makes failure part of each
function's type signature, so a caller cannot reach `.data` without narrowing
first and cannot forget to handle it. Throwing would make the failure path
invisible to the type system. Codes are a closed union: `FORBIDDEN`,
`NOT_FOUND`, `VALIDATION`, `INVALID_PARENT`.

---

## 3. Data model

Five entities, all stored flat as `Record<id, Entity>`. See `src/types/`.

```
Container ─ parentId ──────► Container    workspace → space → folder → list
Status    ─ listId ────────► Container    each list owns its own status set
Task      ─ primaryListId ─► Container    the list it lives in
          ─ statusId ──────► Status       must belong to primaryListId
          ─ assigneeIds ───► User[]
Grant     ─ resourceId ────► Container    a space, folder or list
          ─ userId ────────► User
```

### Containers are one shape, not four

Workspace, space, folder and list share a single interface with a `type`
discriminator, because they share every field. Nesting is constrained by
`VALID_PARENT_TYPE` and enforced on create and move. Lists are the leaves of
the container tree — they hold tasks, never other containers.

### Tasks are not tree nodes

Containers point at containers via `parentId`; a task points at its list via
`primaryListId`. The names differ deliberately, so tree-walking code cannot
accidentally recurse into tasks.

### Statuses are owned per list, and `category` is why that works

Each list has its own status objects — Bugs uses _Open / Triaging / Fixed_
while Sprint 1 uses _To Do / In Progress / Done_. Nothing is shared.

`name` is what a person reads; `category` (`todo` | `active` | `done`) is what
the code reads. Names differ per list but the three meanings do not, so
`category` is the only thing that can connect a status in one list to its
equivalent in another.

That matters when a task moves lists. Its old `statusId` points at a status
the destination board never renders, so the card would silently vanish. The
move resolves a new status by matching `category`, and changes
`primaryListId` and `statusId` **together** — they are two halves of one fact.
The same lookup decides where a new task starts, which is why creating one in
Bugs lands in "Open" rather than looking for a column named "To Do".

### References, not copies

A task stores `statusId`, not the status; `assigneeIds`, not the people. Each
fact is written down once, so renaming a column or a user cannot leave stale
copies scattered across tasks. Views resolve ids on read.

### The tree is derived, never stored

Containers are flat. `buildTree` nests them on read. Nested storage would make
three common operations awkward: reordering a sibling becomes splicing a
nested array rather than changing one number; permission filtering becomes
recursive pruning rather than one pass; and looking an entity up by id becomes
a search. It also means switching user changes nothing in storage — the
selector simply runs again.

### Two invariants the store protects

1. A task's `statusId` must point at a `Status` whose `listId` equals the
   task's `primaryListId`.
2. A container's `parentId` must satisfy `VALID_PARENT_TYPE`.

### Deviations from the brief's field tables

| Added                  | Why                                                          |
| ---------------------- | ------------------------------------------------------------ |
| `Container.visibility` | Section 5 needs public vs private; section 1 never stores it |
| `Container.archivedAt` | Section 1 asks for soft-delete/archive but not how           |
| `Task.id`              | Omitted from their table                                     |
| `Task.primaryListId`   | Named in the operations list, absent from the field table    |
| `Status.listId`        | "Each list owns a status set" — the link is never specified  |
| `User`                 | Described only in prose; the shape is ours                   |

`Task.status` is named **`statusId`**, because it holds a reference rather
than a value — the brief itself says it must "map to" a status.

**Ids:** seed entities use readable ids (`list-bugs`) so tests and debugging
stay legible; anything created at runtime uses `crypto.randomUUID()`.

### Seed fixtures

`src/data/seed.ts` builds **1 workspace, 2 spaces, 2 folders, 3 lists, 16
tasks, 3 users and 3 grants**.

```
FoodApp                        workspace
├── Engineering                space   · public
│   └── Mobile App             folder
│       ├── Sprint 1           list    · To Do / In Progress / Done
│       └── Bugs               list    · Open / Triaging / Fixed
└── Product                    space   · PRIVATE
    └── Roadmap                folder
        └── Q3 Features        list    · To Do / In Progress / Done
```

Two things are arranged deliberately rather than filled in arbitrarily.

**Bugs uses a different status set.** That is the visible proof that status
sets are owned per list rather than shared globally — switch between Sprint 1
and Bugs and the columns change name.

**Every user sees something different.** Alice sees all three lists, Bob sees
only Sprint 1, Carol sees Bugs and Q3 Features. Three distinct views rather
than two, so the permission model is demonstrable in one pass of the switcher
rather than needing explanation.

The fixtures also cover the UI states without any setup: all five priorities
appear, three tasks are unassigned, two have several assignees, two are
overdue, and the Q3 "Done" column is empty so the empty-column state is
visible on first load.

`src/data/seed.test.ts` asserts the fixtures are internally consistent —
parent types, status ownership, dangling ids, duplicate positions. Those are
not the permission tests the brief asks for; they exist so a mistyped id
fails loudly rather than appearing later as a blank column.

### Persistence — the choice the brief asked me to document

**localStorage, versioned, behind an adapter.**

Moving a task and then losing it on refresh reads as broken, and the brief
treats product feel as part of the MVP. It also removes any ambiguity from the
requirement that status and position "persist after drop".

The adapter exposes `load()` and `save()` — the same shape an API client would
have. `load()` is deliberately `async`: reading localStorage is synchronous,
but this is the seam that would be swapped for a network call, so keeping the
signature promise-shaped means the loading state is a real await rather than a
staged delay.

**What is persisted:** entities only. Never UI state — restoring a half-open
drawer on refresh would be worse than not persisting at all. Readiness is not
stored either, since it describes the adapter's own progress.

**Trade-offs accepted:**

- The stored data carries a schema version. On mismatch the app discards it
  and reseeds. Without this, changing a type mid-build leaves stale data in a
  shape the code can no longer read.
- Once localStorage has data the seed path stops running — yet an empty
  browser is the only way a reviewer will ever open the app. Cold start is
  therefore tested deliberately rather than assumed.

### Delete semantics — the other choice the brief asked me to document

**Containers are archived (soft delete). Tasks are deleted outright.**

Archiving sets `archivedAt` and leaves the record and its tasks in the store.
The subtree disappears with it for free: `buildTree` never reaches children
whose parent was filtered out, so nothing has to be cascaded by hand. Sibling
positions are renumbered so no gap is left behind.

The menu item is labelled **Delete** rather than Archive, deliberately. Users
look for "delete", and promising an archive we cannot restore from would be
the dishonest option — there is no un-archive UI, and the brief does not ask
for one. Soft delete is an implementation detail that keeps the data
recoverable; the label describes what the user is doing.

Tasks differ because the reasoning does not carry: losing a branch would take
its tasks with it, but a single task has nothing hanging off it. A real
delete is the honest behaviour, and the column is renumbered afterwards.

---

## 4. How permissions are enforced

All rules live in `src/store/permissions.ts` as pure functions over state.
Nothing in a component decides access; components render what a selector hands
them, and mutations are refused by the store whether or not the UI bothered to
hide the control.

### The rule

> A container is reachable by a user if they are an **admin**, or if **every**
> node on the path from the workspace down to it is individually permitted.
>
> A node is individually permitted when it is not archived, carries no `deny`
> grant for that user, and is either `public` or carries an explicit `allow`
> grant for that user.

Two consequences, both load-bearing:

- **Deny beats allow.** A grant saying no wins over anything saying yes.
- **A hidden ancestor hides its whole subtree**, however public the
  descendants are.

### The three users, worked through

Seed grants: `deny Bob → Bugs`, `deny Carol → Sprint 1`,
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
private. That cascade is not special-cased — it falls out of the path walk,
and of filtering the tree **before** nesting it rather than after.

### Where each check sits

| Surface        | What happens                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar tree   | `visibleContainers()` filters, then `buildTree()` nests. A dropped parent is never recursed into, so its children never appear.                                                         |
| Opening a list | The route resolves `listAccess()` and renders a 403 view. "Denied" and "does not exist" stay distinct.                                                                                  |
| Task drawer    | A task is resolved **through** the permission check, not by id. `?task=` is guessable, so an unchecked lookup would leak a denied task's title and assignees via an allowed list's URL. |
| Breadcrumb     | Suppressed for an unreachable list — it names every ancestor, which would describe a private space the user is not meant to know exists.                                                |
| Every mutation | Returns `{ error: { code: 'FORBIDDEN', … } }`. Task actions check the list the task lives in; a move checks **both** ends, so a task cannot be pushed into a list the user cannot see.  |

### Members versus admins

The brief promises members exactly one thing — "can edit tasks in those
lists" — and is silent on structure. Where it is silent, the line drawn here
is:

- **Tasks:** any member may create, edit, move, reorder and delete tasks in a
  list they can reach. View and edit are the same question; a read-only role
  is what would split them.
- **Containers:** admin only. Creating, renaming, deleting and reordering the
  tree are refused for members, and the controls are hidden.

This is our decision, not the brief's. The reasoning: Alice "edits
**everything**" only means something if there is something Bob cannot edit,
and a second visible difference makes the Alice-vs-Bob demo clearer.

### Why the tests are the evidence

`src/store/permissions.test.ts` asks "what can Bob see?" with **nothing
rendered**. That is only possible because the rules are not in a component —
if they were, the question could not be asked without mounting the sidebar.
`src/features/shell/UserSwitcher.test.tsx` covers the other half: switching
user immediately changes the tree, the board, the breadcrumb and the 403.

To watch the store refuse a mutation directly, in the browser console:

```js
const { useStore } = await import('/src/store/store.ts')
useStore.getState().setCurrentUser('user-bob')
useStore.getState().updateTask('task-fix-crash', { priority: 'low' })
// → { error: { code: 'FORBIDDEN', message: 'You do not have access to that list.' } }
```

### Extending the model

The brief explicitly does not ask for team grants or complex inheritance. Both
would be confined to `permissions.ts`:

- **Teams.** The same grant table with a `subjectType` of `'user' | 'team'`
  plus a membership list. Resolution gathers every grant whose subject matches
  the user, keeping deny-wins. The path walk is unchanged.
- **Per-resource roles.** Replace the `allow | deny` flag with a role
  (`viewer` / `editor` / `admin`). The boolean helpers collapse into one
  `roleFor(user, container)` that walks the same path and keeps the narrowest
  role it finds. `canEditTasksIn` then stops being an alias for
  `canViewContainer`, which is the point.
- **Inherited overrides.** Today a node's own grant is absolute. A "most
  specific wins" model would collect grants along the path and take the last
  one instead of failing at the first deny — a change to one loop.
- **A real backend.** These checks move to the server. The client copy becomes
  a UI hint only: client-side checks are not security, they just save a round
  trip and stop the interface offering what will be refused.

---

## 5. Trade-offs

### Stretch goals attempted — 2 of 7

The brief caps these at two, so the MVP was finished first and these were
chosen last, on the grounds that both could be completed rather than started.

**1 · Deployed preview (Vercel).** Live at
[flowboard-modiumang28.vercel.app](https://flowboard-modiumang28.vercel.app), redeploying on every push to `main`.
Worth noting that a Vite SPA needs an explicit rewrite to
survive a refresh: `/list/list-bugs` has no file behind it, so without
`vercel.json` the server 404s before the router ever loads. Real files are
matched first, so assets are unaffected.

**2 · Client-side search on task title and description.**

Chosen over the other five because it is the one that had to pass back
through the permission layer. Search spans every list — that is what makes it
useful — which also makes it the easiest place in the app to leak: without
filtering, Bob searching "crash" would surface the title of a task in the
Bugs list he is explicitly denied. Results run through the same
`canViewContainer` the sidebar uses rather than a parallel rule that could
drift from it, so searching the same word as Alice, Bob and Carol returns
three different sets.

Title matches rank above description-only matches, and a result that matched
on the body shows a snippet centred on the match so it explains itself. The
input is a Headless UI combobox, so arrow keys, Enter and Escape work without
hand-rolling them.

### Stretch goals not attempted, and why

| Not attempted                   | Reasoning                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Optimistic UI with rollback** | A poor fit here rather than a time problem. It needs a failure to roll back _from_, and nothing in this app can fail after the fact — permission checks are synchronous and resolve before the move lands. Simulating one would be theatre. It becomes real with a backend.                                                   |
| **Activity feed**               | The most interesting of the seven, but there is only ever one actor: the feed would replay your own actions, with the "who" coming from a switcher you just clicked. It also means touching every mutation. Worth noting this is the one feature Redux would have given nearly free, as its action log is the data structure. |
| **Bulk update**                 | Selection state plus a bulk action bar plus multi-target actions, for a modest payoff.                                                                                                                                                                                                                                        |
| **Keyboard shortcuts**          | Thin, and hard to demonstrate — a reviewer will not discover them.                                                                                                                                                                                                                                                            |
| **Storybook**                   | Tooling rather than product. It adds configuration surface without making the app better.                                                                                                                                                                                                                                     |

### Cut on purpose

| Cut                                       | Reasoning                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Subtasks**                              | Explicitly "stretch within MVP". `parentTaskId` is not on the model.                                                                                                           |
| **Status editing UI**                     | The brief requires lists to _own_ status sets, not that users can edit them. Sets are seeded; a new list gets To Do / In Progress / Done.                                      |
| **Grant management UI**                   | The brief specifies the grant _model_ and asks for sample grants in the fixtures, but never a flow for managing them — and with no backend there is nobody to grant access to. |
| **Simulated pagination**                  | Explicitly optional, and paginating in-memory data adds complexity with no visible payoff at 16 tasks.                                                                         |
| **Un-archive**                            | Archiving is reachable; restoring is not. The brief asks for soft-delete, not a trash view.                                                                                    |
| **E2E tests**                             | The brief says "component test **or** E2E". The component tests cover the critical paths for far less setup.                                                                   |
| **Gesture-level drag tests**              | Attempted and removed — see below.                                                                                                                                             |
| **`createdAt`/`updatedAt` on containers** | Only required on tasks.                                                                                                                                                        |

### Known gaps

- **Drag and drop has no gesture-level test.** A keyboard-driven harness was
  written and then deleted: jsdom reports every element as 0×0 and never
  translates dnd-kit's collision rectangle, so the suite could not distinguish
  a working implementation from a broken one — it passed _more_ assertions
  against a configuration that reordered rows on an accidental click. A
  harness that prefers the bug is worse than none. The rules underneath
  (`resolveSiblingDrop`, `reorderTask`, `moveTaskToStatus`) are unit tested;
  the gesture is verified in a browser.
- **`setCurrentUser` returns `void`** while every other action returns
  `Result<T>`. It has a failure case — an unknown id — that it swallows. The
  only caller maps over `users` so it cannot happen, but it is the one place
  the store's contract is not honoured.
- **Loading skeletons rarely appear.** They are wired to the one genuine wait
  the app has, the persistence adapter resolving at boot, which takes a frame.
  No delay is staged anywhere: slowing the app down to display a spinner would
  be worse product than not having one.

### Week 2

1. **An admin permissions panel per container** — a user list with
   allow / deny / inherit and a public-private toggle, backed by `setGrant`,
   `removeGrant` and `setVisibility`. The resolution rule would not change at
   all; only the data feeding it.
2. **Un-archive** — an "Archived" section with restore, which makes the soft
   delete honest and lets the menu item go back to being called Archive.
3. **Optimistic updates with rollback**, which only becomes meaningful once a
   real backend can refuse an action after the UI has already moved the card.
4. **Playwright for the drag gestures** — a real browser is the only place
   they can be tested honestly.
5. **Fractional indexing for `position`.** Reordering currently renumbers a
   whole column, which is fine at this size and wrong at scale.
6. **Virtualise the list view** once a list can hold thousands of tasks.
7. **Cross-tab sync** via the `storage` event — two tabs currently share
   localStorage but not state.

---

## 6. AI usage log

**Tool:** Claude Code (Anthropic), used throughout as a pair rather than a
generator — scaffolding, test writing, and reviewing my own work back at me.

### Where it helped most

- **Test breadth.** The suite is far larger than I would have written by hand
  in the time. Bulk-generating cases around the seed fixtures, then pruning
  the ones that only restated the implementation, was much faster than
  writing each by hand.
- **Finding bugs I had not looked for.** Two permission leaks surfaced from
  asking it to attack its own work: the drawer resolved `?task=` by id with no
  access check, so a guessable id exposed a denied task through an allowed
  list's URL; and the breadcrumb named every ancestor of a forbidden list,
  describing a private space the user was not meant to know existed. Neither
  is in the brief.
- **Diagnosing the sidebar drag.** Reordering silently did nothing. Tracing it
  showed two causes: the droppable ref was on the `<li>`, which wraps its own
  children, so a parent's rectangle covered its whole subtree; and collision
  detection searched every row in the tree, so dragging a list resolved to the
  workspace three levels up.
- **Reading the brief closely.** Requirements that are easy to skim past —
  that status sets are owned per list, that `category` is what makes a
  cross-list move land correctly — were caught in the modelling phase rather
  than discovered late.

### Where I corrected it

- **It led with implementation.** Early on it answered "explain this" with
  code and build plans. I pushed back and asked it to decode the problem
  first; the data model discussion that followed is what shaped the schema.
- **It recommended Tailwind v3 on a flawed premise** — that v4's `@theme`
  block would violate the "no custom CSS" rule. It reversed itself when
  challenged: every Tailwind version needs a CSS entry point, so the rule
  cannot mean that. We shipped v4.
- **It overstated a bug.** It called the board's unchecked drag results "a
  genuine bug"; checking the guards showed the error paths were unreachable,
  because the board only passes ids it just rendered. It corrected the framing
  to "latent, not live" — worth fixing for contract consistency, not urgency.
- **It wrote a test harness that scored a broken implementation higher.** The
  drag suite passed 10/12 against a version that reordered rows on an
  accidental click and 9/12 against the fix. I had it delete the harness
  rather than trust it.
- **It kept over-explaining.** Several rounds of asking for shorter, plainer
  answers before the working rhythm settled.
- **Two self-inflicted mistakes worth recording.** It overwrote a file I had
  open unsaved in the editor, and it committed a stray `console.log` by
  staging a whole directory without reading the diff. Both were caught, but
  they are the cost of letting it move quickly.

### What I rejected

- **An inline "add task" composer per column.** It built one; I asked for a
  single Create button in the top bar instead, so creation works identically
  from the board and the list view.
- **Native `<select>` elements.** Fine functionally, but macOS renders the
  menu over the field you are changing. Replaced with Headless UI listboxes.
- **A tooltip on task titles.** Added on request, then removed — the board
  wraps titles rather than truncating them, so it was repeating visible text.
- **A "reset demo data" button.** Demo tooling does not belong in the product
  surface; it is a line in this README instead.

---

## 7. Styling: the rule and its exceptions

Styling is Tailwind utility classes in TSX. No custom CSS, no CSS modules, no
SCSS, no CSS-in-JS. The only component library is Headless UI, which the brief
names as acceptable and which ships no styles of its own.

**`src/index.css` is the only stylesheet.** It contains an `@import` and a
`@theme` block and nothing else — no selectors, no style rules. In Tailwind v4
that block is where design tokens are declared, so it is configuration that
happens to live in a `.css` file. Every version of Tailwind needs one CSS
entry point, so the rule cannot mean "no CSS files"; it means no hand-written
style rules, and there are none.

**The token set is 14 values**, all in use: 8 colours, 1 font family, 2 radii,
3 shadows. Priority and status share the same five accents — an `urgent` task
and an `open` status are the same red — and each accent covers both text and
its badge tint through an opacity modifier (`text-accent-red` with
`bg-accent-red/10`). That is what makes the colours consistent between kanban
cards and list rows by construction rather than by vigilance. Plain text uses
Tailwind's built-in slate scale; there is no reason to redefine it.

One constraint worth noting in the code: Tailwind cannot build class names at
runtime, so `text-accent-${color}` would never compile. The accents therefore
live in static lookup maps in `src/lib/accents.ts`.

### Exception 1 — dnd-kit transforms

Exactly two inline `style=` attributes exist in the source:

| File                                      | Line |
| ----------------------------------------- | ---- |
| `src/features/board/SortableTaskCard.tsx` | 30   |
| `src/features/sidebar/TreeNodeRow.tsx`    | 109  |

Both are the same:

```tsx
style={{ transform: CSS.Transform.toString(transform), transition }}
```

dnd-kit computes the transform from pointer position during the gesture, so
the value only exists mid-drag and changes every frame. No class can express
it. This is the "tiny exceptions for DnD library-required transforms" the
brief permits; it sets `transform` and `transition` only, never layout or
theming, and there are no others.

### Exception 2 — Headless UI's anchored menus

Three components pass `anchor` to a Headless UI dropdown — the sidebar row
menu, the user switcher, and the `Select` used by the drawer and create
dialog. Headless UI positions those with Floating UI, which writes inline
`top` / `left` onto the portalled menu at runtime.

This is not something the project writes, and it is the same category as the
DnD transform: a runtime-measured value a utility class cannot express. It is
listed because the honest answer to "are there inline styles in the DOM?" is
yes, and a reviewer inspecting an open menu would find them.

The alternative was positioning menus with absolute Tailwind classes. That was
tried and dropped: menus near the bottom of the sidebar were clipped by the
scroll container, which is the problem Floating UI exists to solve.
