import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useMemo, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { Select } from '../../components/Select'
import { PRIORITY_LABEL } from '../../lib/accents'
import { fromDateInputValue, toDateInputValue } from '../../lib/format'
import { isError } from '../../lib/result'
import { defaultStatusFor, statusesForList } from '../../store/board'
import { useStore } from '../../store/store'
import { PRIORITIES, type Priority } from '../../types'

/*
  Creating a task is one mutation, so everything the form collects is gathered
  here and handed to the store in a single call — no create-then-edit, and one
  timestamp.

  Only the list currently open can be created into: the breadcrumb beside the
  button already says which that is, so a list picker would restate it.
*/

const INPUT =
  'w-full rounded-card border border-line bg-white px-2.5 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:outline-none'

/*
  Mounted only while open, so every Create starts from a blank form — typing
  something, cancelling, and reopening must not bring the old draft back.
*/
interface Props {
  listId: string
  onClose: () => void
}

export function CreateTaskDialog({ listId, onClose }: Props) {
  const statuses = useStore((state) => state.statuses)
  const users = useStore((state) => state.users)
  const createTask = useStore((state) => state.createTask)

  const columns = useMemo(
    () => statusesForList(Object.values(statuses), listId),
    [statuses, listId],
  )
  const userList = useMemo(() => Object.values(users), [users])

  // New tasks start in the list's not-started column, found by category so it
  // works whether that column is called "To Do" or "Open".
  const fallbackStatusId = useMemo(
    () => defaultStatusFor(Object.values(statuses), listId)?.id ?? '',
    [statuses, listId],
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [statusId, setStatusId] = useState(fallbackStatusId)
  const [priority, setPriority] = useState<Priority>('none')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /*
    Title is the only thing a person must supply — the brief marks every other
    field optional, and the status is preselected. Create stays disabled until
    it has content, so the form says what is missing rather than reporting it
    after the fact. The store validates regardless; the UI is not the guard.
  */
  const canCreate = title.trim().length > 0

  const submit = () => {
    if (!canCreate) return
    const result = createTask(listId, {
      title,
      statusId: statusId || fallbackStatusId,
      description,
      priority,
      assigneeIds,
      dueDate,
    })

    if (isError(result)) {
      setError(result.error.message)
      return
    }
    onClose()
  }

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-900/25 duration-150 ease-out data-closed:opacity-0"
      />

      <div className="fixed inset-0 grid place-items-start justify-items-center overflow-y-auto p-4 pt-[12vh]">
        <DialogPanel
          transition
          className="w-full max-w-lg rounded-panel bg-white shadow-drag duration-150 ease-out data-closed:scale-95 data-closed:opacity-0"
        >
          <div className="border-b border-line px-5 py-3.5">
            <DialogTitle className="text-sm font-semibold text-slate-900">
              New task
            </DialogTitle>
          </div>

          {error && (
            <p
              role="alert"
              className="border-b border-line bg-accent-red/10 px-5 py-2 text-sm text-accent-red"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 px-5 py-4">
            <input
              autoFocus
              aria-label="Title"
              required
              value={title}
              placeholder="What needs doing?"
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
              className={`${INPUT} text-base font-medium`}
            />

            <textarea
              rows={3}
              aria-label="Description"
              value={description}
              placeholder="Add more detail…"
              onChange={(event) => setDescription(event.target.value)}
              className={`${INPUT} resize-y`}
            />

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Status</span>
                <Select
                  label="Status"
                  value={statusId || fallbackStatusId}
                  onChange={setStatusId}
                  options={columns.map((status) => ({
                    value: status.id,
                    label: status.name,
                  }))}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Priority</span>
                <Select
                  label="Priority"
                  value={priority}
                  onChange={setPriority}
                  options={PRIORITIES.map((option) => ({
                    value: option,
                    label: PRIORITY_LABEL[option],
                  }))}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Due date</span>
              <input
                type="date"
                aria-label="Due date"
                value={toDateInputValue(dueDate)}
                onChange={(event) => setDueDate(fromDateInputValue(event.target.value))}
                className={INPUT}
              />
            </label>

            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-xs text-slate-500">Assignees</legend>
              <ul className="flex flex-wrap gap-1.5">
                {userList.map((user) => {
                  const assigned = assigneeIds.includes(user.id)
                  return (
                    <li key={user.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-1.5 rounded-card border px-2 py-1 text-sm transition ${
                          assigned
                            ? 'border-brand bg-brand/5 text-slate-900'
                            : 'border-line text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={assigned}
                          onChange={() =>
                            setAssigneeIds((current) =>
                              assigned
                                ? current.filter((id) => id !== user.id)
                                : [...current, user.id],
                            )
                          }
                          className="sr-only"
                        />
                        <Avatar user={user} />
                        {user.name}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-card border border-line px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canCreate}
              className="cursor-pointer rounded-card bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
