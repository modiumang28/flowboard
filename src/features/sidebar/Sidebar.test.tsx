import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Sidebar } from './Sidebar'

const renderSidebar = (path = '/list') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  )

describe('Sidebar', () => {
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
