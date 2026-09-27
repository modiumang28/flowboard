import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { seededState, useStore } from '../../store/store'
import { Sidebar } from './Sidebar'

const renderSidebar = (path = '/list') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  )

const containers = () => Object.values(useStore.getState().containers)
const named = (name: string) => containers().find((c) => c.name === name)

beforeEach(() => {
  useStore.setState(seededState())
})

describe('Sidebar — reading the tree', () => {
  it('renders the whole tree expanded', () => {
    renderSidebar()
    for (const name of [
      'FoodApp',
      'Engineering',
      'Mobile App',
      'Sprint 1',
      'Bugs',
      'Product',
      'Roadmap',
      'Q3 Features',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('collapses a branch and hides its descendants', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Collapse Engineering' }))

    expect(screen.getByRole('button', { name: 'Engineering' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mobile App' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sprint 1' })).not.toBeInTheDocument()

    // The Product branch is untouched.
    expect(screen.getByRole('button', { name: 'Q3 Features' })).toBeInTheDocument()
  })

  it('gives a chevron only to rows that have children', () => {
    renderSidebar()
    expect(
      screen.getByRole('button', { name: 'Collapse Mobile App' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /(Expand|Collapse) Bugs/ }),
    ).not.toBeInTheDocument()
  })

  it('marks the list from the URL as current', () => {
    renderSidebar('/list/list-bugs')

    expect(screen.getByRole('button', { name: 'Bugs' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Sprint 1' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('orders siblings by position', () => {
    renderSidebar()
    const nav = screen.getByRole('navigation', { name: 'Workspace' })
    const names = within(nav)
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((name): name is string => Boolean(name))

    expect(names.indexOf('Sprint 1')).toBeLessThan(names.indexOf('Bugs'))
    expect(names.indexOf('Engineering')).toBeLessThan(names.indexOf('Product'))
  })
})

describe('Sidebar — creating', () => {
  it('adds a space under the workspace once it is named', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Add space to FoodApp' }))
    await user.type(
      screen.getByRole('textbox', { name: 'New space name' }),
      'Design{Enter}',
    )

    await waitFor(() => expect(named('Design')?.type).toBe('space'))
    expect(named('Design')?.parentId).toBe('workspace-foodapp')
    expect(
      screen.queryByRole('textbox', { name: 'New space name' }),
    ).not.toBeInTheDocument()
  })

  it('adds a list with its own statuses', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Add list to Mobile App' }))
    await user.type(
      screen.getByRole('textbox', { name: 'New list name' }),
      'Backlog{Enter}',
    )

    const created = named('Backlog')
    expect(created).toBeDefined()
    const statuses = Object.values(useStore.getState().statuses).filter(
      (s) => s.listId === created!.id,
    )
    expect(statuses.map((s) => s.name).sort()).toEqual(['Done', 'In Progress', 'To Do'])
  })

  it('creates nothing when "+" is clicked, until a name is submitted', async () => {
    const user = userEvent.setup()
    renderSidebar()
    const before = containers().length

    await user.click(screen.getByRole('button', { name: 'Add list to Mobile App' }))

    expect(screen.getByRole('textbox', { name: 'New list name' })).toHaveFocus()
    expect(containers()).toHaveLength(before)
  })

  it('ignores Enter on a blank name and keeps the field open', async () => {
    const user = userEvent.setup()
    renderSidebar()
    const before = containers().length

    await user.click(screen.getByRole('button', { name: 'Add list to Mobile App' }))
    const input = screen.getByRole('textbox', { name: 'New list name' })
    await user.type(input, '{Enter}')
    await user.type(input, '   {Enter}')

    expect(containers()).toHaveLength(before)
    expect(input).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('abandons the new item on Escape, even with a name typed', async () => {
    const user = userEvent.setup()
    renderSidebar()
    const before = containers().length

    await user.click(screen.getByRole('button', { name: 'Add list to Mobile App' }))
    await user.type(
      screen.getByRole('textbox', { name: 'New list name' }),
      'Backlog{Escape}',
    )

    expect(
      screen.queryByRole('textbox', { name: 'New list name' }),
    ).not.toBeInTheDocument()
    expect(containers()).toHaveLength(before)
  })

  it('closes a blank field on click away without creating anything', async () => {
    const user = userEvent.setup()
    renderSidebar()
    const before = containers().length

    await user.click(screen.getByRole('button', { name: 'Add list to Mobile App' }))
    await user.click(screen.getByText('Flowboard'))

    expect(
      screen.queryByRole('textbox', { name: 'New list name' }),
    ).not.toBeInTheDocument()
    expect(containers()).toHaveLength(before)
  })

  it('creates a named item on click away, like rename does', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Add list to Mobile App' }))
    await user.type(screen.getByRole('textbox', { name: 'New list name' }), 'Backlog')
    await user.click(screen.getByText('Flowboard'))

    await waitFor(() => expect(named('Backlog')?.parentId).toBe('folder-mobile-app'))
  })

  it('creates exactly one item on Enter', async () => {
    const user = userEvent.setup()
    renderSidebar()
    const before = containers().length

    await user.click(screen.getByRole('button', { name: 'Add list to Mobile App' }))
    await user.type(
      screen.getByRole('textbox', { name: 'New list name' }),
      'Backlog{Enter}',
    )
    await user.click(screen.getByText('Flowboard'))

    expect(containers()).toHaveLength(before + 1)
    expect(containers().filter((c) => c.name === 'Backlog')).toHaveLength(1)
  })

  it('offers no add button on a list, which holds tasks not containers', () => {
    renderSidebar()
    expect(
      screen.getByRole('button', { name: /Add list to Mobile App/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Add .* to Bugs/ }),
    ).not.toBeInTheDocument()
  })
})

describe('Sidebar — renaming', () => {
  const openRename = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole('button', { name: `Actions for ${name}` }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
  }

  it('renames from the actions menu', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Actions for Bugs' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))

    const input = screen.getByRole('textbox', { name: 'Rename Bugs' })
    await user.clear(input)
    await user.type(input, 'Defects{Enter}')

    await waitFor(() =>
      expect(useStore.getState().containers['list-bugs'].name).toBe('Defects'),
    )
  })

  it('abandons the rename on Escape', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await openRename(user, 'Bugs')
    await user.clear(screen.getByRole('textbox', { name: 'Rename Bugs' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Rename Bugs' }),
      'Defects{Escape}',
    )

    expect(useStore.getState().containers['list-bugs'].name).toBe('Bugs')
  })

  it('shows an error for an empty name', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await openRename(user, 'Bugs')
    await user.clear(screen.getByRole('textbox', { name: 'Rename Bugs' }))
    await user.type(screen.getByRole('textbox', { name: 'Rename Bugs' }), '{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('A name is required')
    expect(useStore.getState().containers['list-bugs'].name).toBe('Bugs')
  })
})

describe('Sidebar — archiving', () => {
  it('"Delete" archives a list, removing it from the tree', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Actions for Bugs' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Bugs' })).not.toBeInTheDocument(),
    )
    // Soft delete — the record is still there.
    expect(useStore.getState().containers['list-bugs'].archivedAt).not.toBeNull()
  })

  it('takes the whole subtree with it', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Actions for Product' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Product' })).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: 'Roadmap' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Q3 Features' })).not.toBeInTheDocument()
  })

  it('offers no archive action on the workspace', () => {
    renderSidebar()
    expect(
      screen.queryByRole('button', { name: 'Actions for FoodApp' }),
    ).not.toBeInTheDocument()
  })
})
