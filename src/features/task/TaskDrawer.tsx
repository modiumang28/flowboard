import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { X } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Avatar } from '../../components/Avatar'
import { Select } from '../../components/Select'
import { PRIORITY_LABEL } from '../../lib/accents'
import { formatFullDate, fromDateInputValue, toDateInputValue } from '../../lib/format'
import { isError } from '../../lib/result'
import { canEditTasksIn } from '../../store/permissions'
import { useStore } from '../../store/store'
import { PRIORITIES, type Priority, type Task } from '../../types'

/*
  Headless UI's Dialog covers the accessibility the brief asks for under
  "sensible focus behavior": focus moves into the panel on open, is trapped
  inside it, and returns to the trigger on close. Escape, backdrop clicks and
  scroll locking come with it.

  Edits are held in a local draft and only reach the store when Saved, so the
  board behind the drawer does not change under you while you are still
  deciding. Closing discards the draft.
*/

const INPUT =
  'w-full rounded-card border border-line bg-white px-2 py-1.5 text-sm text-slate-800 transition hover:border-slate-300 focus:border-brand focus:outline-none'

/** The editable subset, held locally until saved. */
interface Draft {
  title: string
  description: string
  statusId: string
  priority: Priority
  assigneeIds: string[]
  dueDate: string | null
  primaryListId: string
}

const draftFrom = (task: Task): Draft => ({
  title: task.title,
  description: task.description,
  statusId: task.statusId,
  priority: task.priority,
  assigneeIds: task.assigneeIds,
  dueDate: task.dueDate,
  primaryListId: task.primaryListId,
})

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-start gap-3 py-2">
      <dt className="pt-1.5 text-xs text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm text-slate-800">{children}</dd>
    </div>
  )
}

interface Props {
  taskId: string | null
  onClose: () => void
}

export function TaskDrawer({ taskId, onClose }: Props) {
  /*
    Resolved through the permission check, not by id alone. The route guard
    only vets the list in the path, so ?task= pointing at a task in a denied
    list would otherwise read straight out of the store — the task id is
    guessable and the drawer would happily show its title and assignees.
  */
  const task = useStore((state) => {
    if (!taskId) return null
    const found = state.tasks[taskId]
    if (!found) return null
    return canEditTasksIn(state, state.currentUserId, found.primaryListId) ? found : null
  })

  return (
    <Dialog open={taskId !== null} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-900/20 duration-200 ease-out data-closed:opacity-0"
      />

      <div className="fixed inset-0 flex justify-end">
        <DialogPanel
          transition
          className="flex w-full max-w-md flex-col bg-white shadow-drag duration-200 ease-out data-closed:translate-x-full"
        >
          {task ? (
            <TaskEditor key={task.id} task={task} onClose={onClose} />
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <DialogTitle className="text-sm font-medium text-slate-900">
                  Task not found
                </DialogTitle>
                <p className="mt-1 text-sm text-slate-500">
                  It may have been deleted or moved.
                </p>
              </div>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}

function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const statuses = useStore((state) => state.statuses)
  const containers = useStore((state) => state.containers)
  const users = useStore((state) => state.users)
  const updateTask = useStore((state) => state.updateTask)
  const moveTaskToList = useStore((state) => state.moveTaskToList)
  const deleteTask = useStore((state) => state.deleteTask)

  // Seeded once per mount. TaskDrawer keys this component by task id, so
  // opening a different task starts a fresh draft without an effect.
  const [draft, setDraft] = useState<Draft>(() => draftFrom(task))
  const [error, setError] = useState<string | null>(null)
  // Shown under the title itself rather than in the banner, since it is about
  // that one field and the fix is to type there.
  const [titleError, setTitleError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const listChanged = draft.primaryListId !== task.primaryListId

  // Only statuses owned by the drafted list — never another list's set.
  const listStatuses = useMemo(
    () =>
      Object.values(statuses)
        .filter((status) => status.listId === draft.primaryListId)
        .sort((a, b) => a.position - b.position),
    [statuses, draft.primaryListId],
  )

  const allLists = useMemo(
    () =>
      Object.values(containers)
        .filter((container) => container.type === 'list' && container.archivedAt === null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [containers],
  )

  const userList = useMemo(() => Object.values(users), [users])

  const isDirty =
    draft.title !== task.title ||
    draft.description !== task.description ||
    draft.statusId !== task.statusId ||
    draft.priority !== task.priority ||
    draft.dueDate !== task.dueDate ||
    draft.primaryListId !== task.primaryListId ||
    draft.assigneeIds.join() !== task.assigneeIds.join()

  const patch = (change: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...change }))

  /*
    A list move and a field edit are two actions, so run the move first: it
    rewrites statusId for the destination list, and only then is the drafted
    status meaningful there.
  */
  const save = () => {
    // Checked before anything runs, so a blank title never half-saves a move.
    if (draft.title.trim() === '') {
      setTitleError('Title is required.')
      titleRef.current?.focus()
      return
    }

    if (listChanged) {
      const moved = moveTaskToList(task.id, draft.primaryListId)
      if (isError(moved)) {
        setError(moved.error.message)
        return
      }
    }

    const statusId = listChanged
      ? (listStatuses.find((status) => status.id === draft.statusId)?.id ?? undefined)
      : draft.statusId

    const result = updateTask(task.id, {
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      assigneeIds: draft.assigneeIds,
      dueDate: draft.dueDate,
      ...(statusId ? { statusId } : {}),
    })

    if (isError(result)) setError(result.error.message)
    else {
      setError(null)
      onClose()
    }
  }

  const discard = () => {
    setDraft(draftFrom(task))
    setError(null)
    setTitleError(null)
  }

  return (
    <>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">{containers[task.primaryListId]?.name}</p>
          <DialogTitle className="sr-only">{task.title}</DialogTitle>
          <input
            ref={titleRef}
            aria-label="Title"
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? 'task-title-error' : undefined}
            value={draft.title}
            onChange={(event) => {
              patch({ title: event.target.value })
              if (event.target.value.trim() !== '') setTitleError(null)
            }}
            // The negative margin matches the padding, so the text still lines
            // up with the list name above it.
            className={`-mx-2.5 mt-1 w-full rounded-card px-2.5 py-1.5 text-base leading-snug font-semibold text-slate-900 transition ${
              titleError
                ? 'bg-white outline-2 outline-accent-red'
                : 'hover:bg-slate-100 focus:bg-white focus:outline-2 focus:outline-brand'
            }`}
          />
          {titleError && (
            <p
              id="task-title-error"
              role="alert"
              className="mt-1.5 text-xs text-accent-red"
            >
              {titleError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 cursor-pointer rounded-card p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <X size={16} />
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="border-b border-line bg-accent-red/10 px-5 py-2 text-sm text-accent-red"
        >
          {error}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-3">
        <dl className="divide-y divide-line">
          <Field label="Status">
            <Select
              label="Status"
              value={draft.statusId}
              onChange={(statusId) => patch({ statusId })}
              options={listStatuses.map((status) => ({
                value: status.id,
                label: status.name,
              }))}
            />
          </Field>

          <Field label="Priority">
            <Select
              label="Priority"
              value={draft.priority}
              onChange={(priority) => patch({ priority })}
              options={PRIORITIES.map((priority) => ({
                value: priority,
                label: PRIORITY_LABEL[priority],
              }))}
            />
          </Field>

          <Field label="Assignees">
            <ul className="flex flex-col gap-1">
              {userList.map((user) => {
                const assigned = draft.assigneeIds.includes(user.id)
                return (
                  <li key={user.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-card px-1 py-1 transition hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={assigned}
                        onChange={() =>
                          patch({
                            assigneeIds: assigned
                              ? draft.assigneeIds.filter((id) => id !== user.id)
                              : [...draft.assigneeIds, user.id],
                          })
                        }
                        className="size-3.5 cursor-pointer accent-brand"
                      />
                      <Avatar user={user} />
                      <span className="text-sm">{user.name}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </Field>

          <Field label="Due">
            <input
              type="date"
              aria-label="Due date"
              value={toDateInputValue(draft.dueDate)}
              onChange={(event) =>
                patch({ dueDate: fromDateInputValue(event.target.value) })
              }
              className={INPUT}
            />
          </Field>

          <Field label="Description">
            <textarea
              aria-label="Description"
              rows={4}
              value={draft.description}
              placeholder="Add a description…"
              onChange={(event) => patch({ description: event.target.value })}
              className={`${INPUT} resize-y`}
            />
          </Field>

          <Field label="List">
            <Select
              label="List"
              value={draft.primaryListId}
              onChange={(primaryListId) => {
                // The current status does not exist in the new list;
                // pick the equivalent stage there by category.
                const category = statuses[draft.statusId]?.category
                const destination = Object.values(statuses)
                  .filter((status) => status.listId === primaryListId)
                  .sort((a, b) => a.position - b.position)
                const next =
                  destination.find((status) => status.category === category) ??
                  destination[0]
                patch({ primaryListId, statusId: next?.id ?? draft.statusId })
              }}
              options={allLists.map((list) => ({
                value: list.id,
                label: list.name,
              }))}
            />
            {listChanged && (
              <p className="mt-1 text-xs text-slate-500">
                Moves to the equivalent stage in that list.
              </p>
            )}
          </Field>

          <Field label="Created">
            <span className="text-slate-500">{formatFullDate(task.createdAt)}</span>
          </Field>

          <Field label="Updated">
            <span className="text-slate-500">{formatFullDate(task.updatedAt)}</span>
          </Field>
        </dl>
      </div>

      {/*
        Deleting asks once, in place. A second dialog on top of this one would
        mean two focus traps competing, for a question that fits in the footer.
      */}
      <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
        {isConfirmingDelete ? (
          <>
            <span className="mr-auto text-xs text-slate-600">Delete this task?</span>
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(false)}
              className="cursor-pointer rounded-card border border-line px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => {
                const result = deleteTask(task.id)
                if (isError(result)) setError(result.error.message)
                else onClose()
              }}
              className="cursor-pointer rounded-card bg-accent-red px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-red/90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="mr-auto cursor-pointer rounded-card px-2 py-1.5 text-sm text-accent-red transition hover:bg-accent-red/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            >
              Delete
            </button>
            {isDirty && <span className="text-xs text-slate-500">Unsaved changes</span>}
            <button
              type="button"
              onClick={() => {
                discard()
                onClose()
              }}
              className="cursor-pointer rounded-card border border-line px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!isDirty}
              className="cursor-pointer rounded-card bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </>
        )}
      </div>
    </>
  )
}
