import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { seededState, useStore } from '../../store/store'

const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  )

const dialog = () => screen.getByRole('dialog')
const column = (name: string) => screen.getByRole('region', { name })

const tasksIn = (statusId: string) =>
  Object.values(useStore.getState().tasks)
    .filter((t) => t.statusId === statusId)
    .sort((a, b) => a.position - b.position)

const openCreate = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Create' }))

/** Headless UI portals its listbox options outside the dialog. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(within(dialog()).getByRole('button', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

beforeEach(() => {
  useStore.setState(seededState())
})

describe('The Create button', () => {
  it('is offered once a list is open', () => {
    renderApp('/list/list-bugs')
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('is hidden when no list is open', () => {
    renderApp('/list')
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
  })

  it('is offered in the list view too', () => {
    renderApp('/list/list-bugs?view=list')
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
})

describe('Creating a task', () => {
  it('starts in the list’s not-started column, whatever it is called', async () => {
    const user = userEvent.setup()
    // Bugs calls its todo column "Open", not "To Do".
    renderApp('/list/list-bugs')
    await openCreate(user)

    expect(within(dialog()).getByRole('button', { name: 'Status' })).toHaveTextContent(
      'Open',
    )
  })

  it('creates from a title alone', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.type(within(dialog()).getByLabelText('Title'), 'Check the logs')
    await user.click(within(dialog()).getByRole('button', { name: 'Create' }))

    const created = tasksIn('status-bugs-open').at(-1)
    expect(created?.title).toBe('Check the logs')
    expect(created).toMatchObject({ priority: 'none', assigneeIds: [], dueDate: null })
  })

  it('carries every field through in one go', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.type(within(dialog()).getByLabelText('Title'), 'Payment retry')
    await user.type(within(dialog()).getByLabelText('Description'), 'Loops forever.')
    await choose(user, 'Status', 'Triaging')
    await choose(user, 'Priority', 'Urgent')
    await user.click(within(dialog()).getByText('Carol Singh'))
    await user.click(within(dialog()).getByRole('button', { name: 'Create' }))

    const created = tasksIn('status-bugs-triaging').at(-1)
    expect(created).toMatchObject({
      title: 'Payment retry',
      description: 'Loops forever.',
      priority: 'urgent',
      assigneeIds: ['user-carol'],
      primaryListId: 'list-bugs',
    })
  })

  it('submits on Enter in the title', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.type(within(dialog()).getByLabelText('Title'), 'Quick one{Enter}')

    expect(tasksIn('status-bugs-open').at(-1)?.title).toBe('Quick one')
  })

  it('closes afterwards, without opening the drawer', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.type(within(dialog()).getByLabelText('Title'), 'Quick one{Enter}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows the new card on the board', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.type(within(dialog()).getByLabelText('Title'), 'Check the logs{Enter}')

    await waitFor(() =>
      expect(
        within(column('Open')).getByRole('heading', { name: 'Check the logs' }),
      ).toBeInTheDocument(),
    )
  })

  it('adds to the bottom of its column', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.type(within(dialog()).getByLabelText('Title'), 'Last one{Enter}')

    expect(
      tasksIn('status-bugs-open')
        .map((t) => t.title)
        .at(-1),
    ).toBe('Last one')
  })

  it('creates into the open list, not another one', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-q3-features')
    await openCreate(user)

    await user.type(within(dialog()).getByLabelText('Title'), 'Roadmap item{Enter}')

    const created = Object.values(useStore.getState().tasks).find(
      (t) => t.title === 'Roadmap item',
    )
    expect(created?.primaryListId).toBe('list-q3-features')
  })
})

describe('Create — refusing and cancelling', () => {
  it('refuses an empty title and stays open', async () => {
    const user = userEvent.setup()
    const before = Object.keys(useStore.getState().tasks).length
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.click(within(dialog()).getByRole('button', { name: 'Create' }))

    expect(within(dialog()).getByRole('alert')).toHaveTextContent('A task needs a title')
    expect(Object.keys(useStore.getState().tasks)).toHaveLength(before)
  })

  it('creates nothing on Cancel', async () => {
    const user = userEvent.setup()
    const before = Object.keys(useStore.getState().tasks).length
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.type(within(dialog()).getByLabelText('Title'), 'Never mind')
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(Object.keys(useStore.getState().tasks)).toHaveLength(before)
  })

  it('creates nothing on Escape', async () => {
    const user = userEvent.setup()
    const before = Object.keys(useStore.getState().tasks).length
    renderApp('/list/list-bugs')
    await openCreate(user)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(Object.keys(useStore.getState().tasks)).toHaveLength(before)
  })

  it('forgets an abandoned draft when reopened', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')

    await openCreate(user)
    await user.type(within(dialog()).getByLabelText('Title'), 'Abandoned')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await openCreate(user)
    expect(within(dialog()).getByLabelText('Title')).toHaveValue('')
  })
})

describe('Deleting a task', () => {
  it('asks before deleting', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await user.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    expect(within(dialog()).getByText('Delete this task?')).toBeInTheDocument()
    expect(useStore.getState().tasks['task-fix-crash']).toBeDefined()
  })

  it('keeps the task when the confirm is dismissed', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await user.click(within(dialog()).getByRole('button', { name: 'Delete' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Keep' }))

    expect(useStore.getState().tasks['task-fix-crash']).toBeDefined()
    expect(within(dialog()).getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('deletes on confirm, closes the drawer and clears the card', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?task=task-fix-crash')

    await user.click(within(dialog()).getByRole('button', { name: 'Delete' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    expect(useStore.getState().tasks['task-fix-crash']).toBeUndefined()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      screen.queryByRole('heading', { name: 'Fix crash on checkout' }),
    ).not.toBeInTheDocument()
  })
})
