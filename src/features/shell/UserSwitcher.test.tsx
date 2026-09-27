import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { seededState, useStore } from '../../store/store'

/*
  The end-to-end half of the permission requirement: the brief asks that
  switching user "immediately reflect what the tree and boards show".

  The rules themselves are covered in store/permissions.test.ts with nothing
  rendered. What is proved here is the wiring — that the filtered selector
  actually reaches the screen, which a pure test cannot tell you.
*/

const renderApp = (path = '/list/list-sprint-1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  )

const tree = () => screen.getByRole('navigation', { name: 'Workspace' })
/** The switcher and breadcrumb repeat these strings, so scope to the content. */
const main = () => screen.getByRole('main')
const listNames = () =>
  within(tree())
    .getAllByRole('button')
    .map((b) => b.textContent)
    .filter(Boolean)

async function switchTo(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: /Switch user/ }))
  await user.click(await screen.findByRole('menuitem', { name: new RegExp(name) }))
}

beforeEach(() => {
  useStore.setState(seededState())
})

describe('Switching user changes the tree', () => {
  it('shows an admin every list', () => {
    renderApp()
    for (const name of ['Sprint 1', 'Bugs', 'Q3 Features']) {
      expect(within(tree()).getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('shrinks the tree the moment Bob is selected', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(listNames()).toContain('Bugs')

    await switchTo(user, 'Bob Martinez')

    await waitFor(() => expect(listNames()).not.toContain('Bugs'))
    // The whole private branch goes, not just the denied list.
    expect(listNames()).not.toContain('Product')
    expect(listNames()).not.toContain('Roadmap')
    expect(listNames()).not.toContain('Q3 Features')
    expect(listNames()).toContain('Sprint 1')
  })

  it('gives Carol a different tree again', async () => {
    const user = userEvent.setup()
    renderApp('/list')

    await switchTo(user, 'Carol Singh')

    await waitFor(() => expect(listNames()).not.toContain('Sprint 1'))
    expect(listNames()).toContain('Bugs')
    expect(listNames()).toContain('Q3 Features')
  })

  it('restores the full tree on switching back', async () => {
    const user = userEvent.setup()
    renderApp('/list')

    await switchTo(user, 'Bob Martinez')
    await waitFor(() => expect(listNames()).not.toContain('Bugs'))

    await switchTo(user, 'Alice Chen')
    await waitFor(() => expect(listNames()).toContain('Bugs'))
  })
})

describe('Switching user changes what is on screen', () => {
  it('replaces the board with a 403 when the open list becomes denied', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-bugs')
    expect(screen.getByRole('region', { name: 'Open' })).toBeInTheDocument()

    await switchTo(user, 'Bob Martinez')

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /don’t have access to this list/ }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByRole('region', { name: 'Open' })).not.toBeInTheDocument()
  })

  it('shows a 403 for a denied list opened straight from its URL', () => {
    useStore.getState().setCurrentUser('user-bob')
    renderApp('/list/list-bugs')

    expect(
      screen.getByRole('heading', { name: /don’t have access to this list/ }),
    ).toBeInTheDocument()
  })

  it('names the identity being refused, since switching user is the fix', () => {
    useStore.getState().setCurrentUser('user-bob')
    renderApp('/list/list-bugs')

    expect(within(main()).getByText(/Bob Martinez/)).toBeInTheDocument()
    expect(within(main()).getByText(/member/)).toBeInTheDocument()
  })

  it('offers a way out of the dead end', async () => {
    const user = userEvent.setup()
    useStore.getState().setCurrentUser('user-bob')
    renderApp('/list/list-bugs')

    await user.click(screen.getByRole('button', { name: 'Back to your lists' }))

    await waitFor(() =>
      expect(within(main()).getByText('No list selected')).toBeInTheDocument(),
    )
  })

  it('keeps “denied” distinct from “does not exist”', () => {
    useStore.getState().setCurrentUser('user-bob')
    renderApp('/list/nope')

    expect(screen.getByText('List not found')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /don’t have access/ }),
    ).not.toBeInTheDocument()
  })

  it('does not leak the breadcrumb for a denied list', () => {
    useStore.getState().setCurrentUser('user-bob')
    renderApp('/list/list-q3-features')

    // Naming the ancestors would describe a private space Bob may not know of.
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(breadcrumb).toHaveTextContent('No list selected')
    expect(breadcrumb).not.toHaveTextContent('Product')
    expect(breadcrumb).not.toHaveTextContent('Roadmap')
  })

  it('will not show a task from a list the user cannot reach', () => {
    useStore.getState().setCurrentUser('user-bob')
    // Sprint 1 is allowed, but this task belongs to Bugs, which is not.
    renderApp('/list/list-sprint-1?task=task-fix-crash')

    expect(screen.getByText('Task not found')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Fix crash on checkout')).not.toBeInTheDocument()
  })

  it('still shows a task from a list the user can reach', () => {
    useStore.getState().setCurrentUser('user-bob')
    renderApp('/list/list-sprint-1?task=task-build-login')

    expect(screen.getByDisplayValue('Build login screen')).toBeInTheDocument()
  })

  it('hides Create on a list the user cannot reach', () => {
    useStore.getState().setCurrentUser('user-bob')
    renderApp('/list/list-bugs')

    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
  })
})

describe('Members cannot reshape the workspace', () => {
  it('offers an admin the structural controls', () => {
    renderApp()
    expect(
      within(tree()).getByRole('button', { name: /Add space to FoodApp/ }),
    ).toBeInTheDocument()
    expect(
      within(tree()).getByRole('button', { name: /Actions for Sprint 1/ }),
    ).toBeInTheDocument()
  })

  it('hides them from a member', async () => {
    const user = userEvent.setup()
    renderApp()

    await switchTo(user, 'Bob Martinez')

    await waitFor(() =>
      expect(
        within(tree()).queryByRole('button', { name: /Add space to FoodApp/ }),
      ).not.toBeInTheDocument(),
    )
    expect(
      within(tree()).queryByRole('button', { name: /Actions for Sprint 1/ }),
    ).not.toBeInTheDocument()
  })

  it('still lets a member open a list they can reach', async () => {
    const user = userEvent.setup()
    renderApp('/list')

    await switchTo(user, 'Bob Martinez')
    await user.click(await within(tree()).findByRole('button', { name: 'Sprint 1' }))

    expect(await screen.findByRole('region', { name: 'To Do' })).toBeInTheDocument()
  })
})
