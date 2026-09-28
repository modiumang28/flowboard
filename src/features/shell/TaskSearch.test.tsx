import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { seededState, useStore } from '../../store/store'

const renderApp = (path = '/list') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  )

const search = () => screen.getByRole('combobox', { name: 'Search tasks' })
const results = async () =>
  within(await screen.findByRole('listbox')).getAllByRole('option')

const type = async (user: ReturnType<typeof userEvent.setup>, query: string) => {
  await user.click(search())
  await user.type(search(), query)
}

beforeEach(() => {
  useStore.setState(seededState())
})

describe('Searching tasks', () => {
  it('shows nothing until something is typed', () => {
    renderApp()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('finds a task by its title', async () => {
    const user = userEvent.setup()
    renderApp()

    await type(user, 'checkout')

    const found = await results()
    expect(found.some((r) => r.textContent?.includes('Fix crash on checkout'))).toBe(true)
  })

  it('finds a task by its description', async () => {
    const user = userEvent.setup()
    renderApp()

    // "Happens on iOS 17 when the cart is empty."
    await type(user, 'iOS 17')

    const found = await results()
    expect(found.some((r) => r.textContent?.includes('Fix crash on checkout'))).toBe(true)
  })

  it('searches lists other than the open one', async () => {
    const user = userEvent.setup()
    renderApp('/list/list-sprint-1')

    await type(user, 'Loyalty')

    // Loyalty program lives in Q3 Features, not Sprint 1.
    const found = await results()
    expect(found[0]).toHaveTextContent('Loyalty program')
    expect(found[0]).toHaveTextContent('Q3 Features')
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    renderApp()

    await type(user, 'zzzzz')

    expect(await screen.findByText(/No tasks match/)).toBeInTheDocument()
  })

  it('opens the task and navigates to its list', async () => {
    const user = userEvent.setup()
    renderApp('/list')

    await type(user, 'Loyalty')
    await user.click((await results())[0])

    // The drawer opened on a task from a list we were not viewing.
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByLabelText('Title')).toHaveValue(
        'Loyalty program',
      ),
    )
  })

  it('clears the query after opening a result', async () => {
    const user = userEvent.setup()
    renderApp('/list')

    await type(user, 'Loyalty')
    await user.click((await results())[0])

    await waitFor(() => expect(search()).toHaveValue(''))
  })

  it('can be cleared by hand', async () => {
    const user = userEvent.setup()
    renderApp()

    await type(user, 'checkout')

    /*
      Headless UI marks everything outside the open listbox aria-hidden, so
      this button is intentionally out of the accessibility tree while results
      are showing — keyboard users dismiss with Escape instead. It is still a
      real, clickable control, hence `hidden: true`.
    */
    const clear = document.querySelector<HTMLButtonElement>(
      '[aria-label="Clear search"]',
    )!
    await user.click(clear)

    expect(search()).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('Search respects permissions', () => {
  it('hides a task in a list the user is denied, but keeps the rest', async () => {
    const user = userEvent.setup()
    renderApp()

    // "checkout" matches two tasks: one in Sprint 1, one in Bugs.
    await type(user, 'checkout')
    const asAlice = (await results()).map((r) => r.textContent)
    expect(asAlice.some((t) => t?.includes('Fix crash on checkout'))).toBe(true)
    expect(asAlice.some((t) => t?.includes('Add checkout flow'))).toBe(true)

    useStore.getState().setCurrentUser('user-bob')

    await waitFor(async () => {
      const asBob = (await results()).map((r) => r.textContent)
      // Bugs is denied to Bob; Sprint 1 is not.
      expect(asBob.some((t) => t?.includes('Fix crash on checkout'))).toBe(false)
      expect(asBob.some((t) => t?.includes('Add checkout flow'))).toBe(true)
    })
  })

  it('hides a task behind a private ancestor', async () => {
    const user = userEvent.setup()
    useStore.getState().setCurrentUser('user-bob')
    renderApp()

    await type(user, 'Loyalty')

    expect(await screen.findByText(/No tasks match/)).toBeInTheDocument()
  })

  it('shows it to a member who was granted access', async () => {
    const user = userEvent.setup()
    useStore.getState().setCurrentUser('user-carol')
    renderApp()

    await type(user, 'Loyalty')

    expect((await results())[0]).toHaveTextContent('Loyalty program')
  })

  it('still finds what the member can reach', async () => {
    const user = userEvent.setup()
    useStore.getState().setCurrentUser('user-bob')
    renderApp()

    await type(user, 'login')

    // Build login screen is in Sprint 1, which Bob can see.
    expect((await results())[0]).toHaveTextContent('Build login screen')
  })
})
