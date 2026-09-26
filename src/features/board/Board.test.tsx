import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Board } from './Board'

describe('Board', () => {
  it('renders the columns belonging to the selected list', () => {
    render(<Board listId="list-bugs" />)
    for (const name of ['Open', 'Triaging', 'Fixed']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'To Do' })).not.toBeInTheDocument()
  })

  it('renders a different column set for a different list', () => {
    render(<Board listId="list-sprint-1" />)
    for (const name of ['To Do', 'In Progress', 'Done']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'Triaging' })).not.toBeInTheDocument()
  })

  it('puts each task in its own column', () => {
    render(<Board listId="list-bugs" />)
    const triaging = screen.getByRole('region', { name: 'Triaging' })
    expect(
      within(triaging).getByRole('heading', { name: 'Login fails on slow networks' }),
    ).toBeInTheDocument()
    expect(
      within(triaging).queryByRole('heading', { name: 'Fix crash on checkout' }),
    ).not.toBeInTheDocument()
  })

  it('shows priority, assignee initials and due date on a card', () => {
    render(<Board listId="list-bugs" />)
    const open = screen.getByRole('region', { name: 'Open' })

    expect(within(open).getByText('Urgent')).toBeInTheDocument()
    expect(within(open).getByTitle('Bob Martinez')).toHaveTextContent('BM')
    // "Fix crash on checkout" is due 2026-09-28.
    expect(within(open).getByText(/late|Today|Tomorrow|\d/)).toBeInTheDocument()
  })

  it('shows an empty state for a column with no tasks', () => {
    render(<Board listId="list-q3-features" />)
    const done = screen.getByRole('region', { name: 'Done' })
    expect(within(done).getByText('No tasks')).toBeInTheDocument()
  })

  it('omits the badge for tasks with no priority', () => {
    render(<Board listId="list-bugs" />)
    const fixed = screen.getByRole('region', { name: 'Fixed' })
    expect(within(fixed).getByRole('heading', { name: /Typo/ })).toBeInTheDocument()
    expect(within(fixed).queryByText('None')).not.toBeInTheDocument()
  })

  it('handles a list with no statuses', () => {
    render(<Board listId="list-nope" />)
    expect(screen.getByText(/no statuses configured/i)).toBeInTheDocument()
  })
})
