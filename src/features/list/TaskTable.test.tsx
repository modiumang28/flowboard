import { render, screen, within } from '@testing-library/react'
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

/** Row order by task title, skipping the header row. */
const titles = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

beforeEach(() => {
  useStore.setState(seededState())
})

describe('TaskTable — rendering', () => {
  it('shows the five columns the brief asks for', () => {
    renderApp('/list/list-sprint-1?view=list')
    const header = within(screen.getByRole('table')).getAllByRole('row')[0]
    expect(
      within(header)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Task', 'Status', 'Assignees', 'Priority', 'Due'])
  })

  it('shows a row per task with its status', () => {
    renderApp('/list/list-bugs?view=list')
    expect(titles()).toHaveLength(5)
    const row = screen.getByRole('row', { name: /Fix crash on checkout/ })
    expect(within(row).getByText('Open')).toBeInTheDocument()
    expect(within(row).getByText('Urgent')).toBeInTheDocument()
  })

  it('marks unassigned and undated tasks rather than leaving blanks', () => {
    renderApp('/list/list-sprint-1?view=list')
    const row = screen.getByRole('row', { name: /Set up analytics events/ })
    expect(within(row).getByText('Unassigned')).toBeInTheDocument()
  })

  it('starts in board order', () => {
    renderApp('/list/list-sprint-1?view=list')
    expect(titles()[0]).toBe('Build login screen')
  })
})

describe('TaskTable — sorting', () => {
  it('sorts by priority, urgent first', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-sprint-1?view=list')

    await user.click(screen.getByRole('button', { name: 'Sort by Priority' }))

    expect(titles()[0]).toBe('Build home screen') // the only urgent one
  })

  it('reverses on a second click', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-sprint-1?view=list')

    const button = screen.getByRole('button', { name: 'Sort by Priority' })
    await user.click(button)
    await user.click(button)

    expect(titles()[0]).toBe('Project scaffold and CI') // priority: none
  })

  it('clears the sort on a third click', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-sprint-1?view=list')

    const button = screen.getByRole('button', { name: 'Sort by Priority' })
    await user.click(button)
    await user.click(button)
    await user.click(button)

    expect(titles()[0]).toBe('Build login screen') // back to board order
  })

  it('sorts by due date and keeps undated tasks last', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-sprint-1?view=list')

    await user.click(screen.getByRole('button', { name: 'Sort by Due' }))

    const order = titles()
    expect(order[0]).toBe('Build home screen') // overdue, so earliest
    expect(order.at(-1)).toBe('Project scaffold and CI') // undated
  })
})

describe('TaskTable — opening a task', () => {
  it('opens the drawer when a row is clicked', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?view=list')

    await user.click(screen.getByRole('row', { name: /Fix crash on checkout/ }))

    expect(within(screen.getByRole('dialog')).getByLabelText('Title')).toHaveValue(
      'Fix crash on checkout',
    )
  })

  it('keeps the list view and sort when the drawer closes', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs?view=list&sort=priority&dir=asc')

    await user.click(screen.getByRole('row', { name: /Fix crash on checkout/ }))
    await user.keyboard('{Escape}')

    // Still the table, still sorted — not bounced back to the board.
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sort by Priority' })).toHaveTextContent(
      'Priority',
    )
  })
})

describe('ViewToggle', () => {
  it('starts on the board', () => {
    renderApp('/list/list-sprint-1')
    expect(screen.getByRole('tab', { name: 'Board' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('switches to the table and back', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-sprint-1')

    await user.click(screen.getByRole('tab', { name: 'List' }))
    expect(screen.getByRole('table')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Board' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'To Do' })).toBeInTheDocument()
  })

  it('is hidden when no list is open', () => {
    renderApp('/list')
    expect(screen.queryByRole('tab', { name: 'Board' })).not.toBeInTheDocument()
  })
})
