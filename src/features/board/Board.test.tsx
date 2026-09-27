import { render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { seededState, useStore } from '../../store/store'
import { Board } from './Board'

// Cards read and write the ?task= param, so they need a router around them.
const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  useStore.setState(seededState())
})

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
    // The due label is relative to today, so pin today. Only Date is faked;
    // real timers keep running for React and Testing Library.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-26T12:00:00.000Z'))
    try {
      render(<Board listId="list-bugs" />)
      const open = screen.getByRole('region', { name: 'Open' })

      expect(within(open).getByText('Urgent')).toBeInTheDocument()
      expect(within(open).getByTitle('Bob Martinez')).toHaveTextContent('BM')
      // "Fix crash on checkout" is due 2026-09-28, two days out.
      expect(within(open).getByText('28 Sept')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
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
