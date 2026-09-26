import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { seededState, useStore } from '../../store/store'

/*
  Rendered through the real App so the URL wiring is covered too: a card click
  must put ?task= in the URL, and the drawer must open from that param alone.
*/
const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  )

const drawer = () => screen.getByRole('dialog')
const task = (id: string) => useStore.getState().tasks[id]
const saveButton = () => within(drawer()).getByRole('button', { name: 'Save' })

/** Dropdowns are Headless UI listboxes, and the menu portals outside the dialog. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(within(drawer()).getByRole('button', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

beforeEach(() => {
  useStore.setState(seededState())
})

describe('TaskDrawer — opening and closing', () => {
  it('stays closed until a card is clicked', () => {
    renderApp('/list/list-bugs')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens from a card', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')

    await user.click(screen.getByRole('heading', { name: 'Fix crash on checkout' }))

    expect(within(drawer()).getByLabelText('Title')).toHaveValue('Fix crash on checkout')
  })

  it('opens directly from a ?task= url', () => {
    renderApp('/list/list-bugs?task=task-login-slow-network')
    expect(within(drawer()).getByLabelText('Title')).toHaveValue(
      'Login fails on slow networks',
    )
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes on the close button', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await user.click(within(drawer()).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('moves focus into the panel when it opens', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')

    await user.click(screen.getByRole('heading', { name: 'Fix crash on checkout' }))

    await waitFor(() => expect(drawer().contains(document.activeElement)).toBe(true))
  })

  it('handles an unknown task id', () => {
    renderApp('/list/list-bugs?task=task-nope')
    expect(within(drawer()).getByText('Task not found')).toBeInTheDocument()
  })
})

describe('TaskDrawer — nothing changes until Save', () => {
  it('disables Save until something is edited', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    expect(saveButton()).toBeDisabled()

    await user.type(within(drawer()).getByLabelText('Title'), '!')

    expect(saveButton()).toBeEnabled()
    expect(within(drawer()).getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('leaves the store untouched while editing', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await choose(user, 'Priority', 'Low')
    await user.type(within(drawer()).getByLabelText('Title'), ' edited')

    expect(task('task-fix-crash').priority).toBe('urgent')
    expect(task('task-fix-crash').title).toBe('Fix crash on checkout')
  })

  it('commits every field on Save and closes', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    const title = within(drawer()).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Fix checkout crash on iOS')
    await choose(user, 'Priority', 'Low')
    await choose(user, 'Status', 'Fixed')
    await user.click(within(drawer()).getByRole('checkbox', { name: /Carol Singh/ }))
    await user.click(saveButton())

    const saved = task('task-fix-crash')
    expect(saved.title).toBe('Fix checkout crash on iOS')
    expect(saved.priority).toBe('low')
    expect(saved.statusId).toBe('status-bugs-fixed')
    expect(saved.assigneeIds).toContain('user-carol')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('drops the draft on Cancel', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await choose(user, 'Priority', 'Low')
    await user.click(within(drawer()).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(task('task-fix-crash').priority).toBe('urgent')
  })

  it('throws the draft away when the drawer is closed', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await user.type(within(drawer()).getByLabelText('Title'), ' edited')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(task('task-fix-crash').title).toBe('Fix crash on checkout')
  })

  it('bumps updatedAt only once Saved', async () => {
    const user = userEvent.setup()
    const before = task('task-fix-crash').updatedAt
    renderApp('/list/list-bugs?task=task-fix-crash')

    await choose(user, 'Priority', 'Low')
    expect(task('task-fix-crash').updatedAt).toBe(before)

    await user.click(saveButton())
    expect(task('task-fix-crash').updatedAt).not.toBe(before)
  })
})

describe('TaskDrawer — validation', () => {
  it('rejects an empty title and keeps the drawer open', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await user.clear(within(drawer()).getByLabelText('Title'))
    await user.click(saveButton())

    expect(within(drawer()).getByRole('alert')).toHaveTextContent('A task needs a title')
    expect(task('task-fix-crash').title).toBe('Fix crash on checkout')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('TaskDrawer — statuses are list-scoped', () => {
  it('offers only the statuses owned by this task’s list', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await user.click(within(drawer()).getByRole('button', { name: 'Status' }))
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent)

    expect(options).toEqual(['Open', 'Triaging', 'Fixed'])
    expect(options).not.toContain('In Progress')
  })
})

describe('TaskDrawer — moving between lists', () => {
  it('remaps the status to the matching category in the new list', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-login-slow-network')

    // Starts in Bugs / Triaging, which is category "active".
    expect(task('task-login-slow-network').statusId).toBe('status-bugs-triaging')

    await choose(user, 'List', 'Sprint 1')
    await user.click(saveButton())

    const moved = task('task-login-slow-network')
    expect(moved.primaryListId).toBe('list-sprint-1')
    // Sprint 1's "In Progress" is the active column there.
    expect(moved.statusId).toBe('status-sprint-1-progress')
  })

  it('swaps the status options to the new list before saving', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await choose(user, 'List', 'Sprint 1')
    await user.click(within(drawer()).getByRole('button', { name: 'Status' }))

    const options = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(options).toEqual(['To Do', 'In Progress', 'Done'])
  })

  it('never leaves a task pointing at another list’s status', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await choose(user, 'List', 'Q3 Features')
    await user.click(saveButton())

    const moved = task('task-fix-crash')
    expect(useStore.getState().statuses[moved.statusId].listId).toBe(moved.primaryListId)
  })
})
