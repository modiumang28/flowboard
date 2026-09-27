import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { seededState, useStore } from '../../store/store'
import { TopBar } from './TopBar'

const renderBar = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar />
    </MemoryRouter>,
  )

beforeEach(() => {
  useStore.setState(seededState())
})

describe('TopBar — breadcrumb', () => {
  it('shows the path from the workspace down to the open list', () => {
    renderBar('/list/list-bugs')

    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent)

    expect(crumbs).toEqual(['FoodApp', 'Engineering', 'Mobile App', 'Bugs'])
  })

  it('marks the open list as the current page', () => {
    renderBar('/list/list-bugs')
    expect(screen.getByText('Bugs')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Engineering')).not.toHaveAttribute('aria-current')
  })

  it('falls back when no list is open', () => {
    renderBar('/list')
    expect(screen.getByText('No list selected')).toBeInTheDocument()
  })
})

describe('TopBar — user switcher', () => {
  it('shows the current user', () => {
    renderBar('/list')
    expect(
      screen.getByRole('button', { name: /Current user: Alice Chen/ }),
    ).toBeInTheDocument()
  })

  it('lists all three users with their roles', async () => {
    const user = userEvent.setup()
    renderBar('/list')

    await user.click(screen.getByRole('button', { name: /Switch user/ }))

    for (const name of ['Alice Chen', 'Bob Martinez', 'Carol Singh']) {
      expect(
        await screen.findByRole('menuitem', { name: new RegExp(name) }),
      ).toBeInTheDocument()
    }
    expect(screen.getByRole('menuitem', { name: /Alice Chen/ })).toHaveTextContent(
      'admin',
    )
    expect(screen.getByRole('menuitem', { name: /Bob Martinez/ })).toHaveTextContent(
      'member',
    )
  })

  it('switches the current user in the store', async () => {
    const user = userEvent.setup()
    renderBar('/list')

    await user.click(screen.getByRole('button', { name: /Switch user/ }))
    await user.click(await screen.findByRole('menuitem', { name: /Bob Martinez/ }))

    expect(useStore.getState().currentUserId).toBe('user-bob')
    expect(
      screen.getByRole('button', { name: /Current user: Bob Martinez/ }),
    ).toBeInTheDocument()
  })
})
