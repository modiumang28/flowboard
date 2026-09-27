import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { seededState, useStore } from '../store/store'
import { notifyOnError, useToasts } from '../store/toasts'

const renderApp = (path = '/list/list-bugs') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  )

const notifications = () => screen.getByRole('region', { name: 'Notifications' })

beforeEach(() => {
  useStore.setState(seededState())
  useToasts.getState().clear()
})

describe('Toaster', () => {
  it('shows nothing until something fails', () => {
    renderApp()
    expect(within(notifications()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces an error assertively', () => {
    renderApp()

    act(() => {
      useToasts.getState().push('You cannot change that list.')
    })

    const alert = within(notifications()).getByRole('alert')
    expect(alert).toHaveTextContent('You cannot change that list.')
  })

  it('uses a polite status for non-errors', () => {
    renderApp()

    act(() => {
      useToasts.getState().push('Saved.', 'info')
    })

    expect(within(notifications()).getByRole('status')).toHaveTextContent('Saved.')
    expect(within(notifications()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('can be dismissed by hand', async () => {
    const user = userEvent.setup()
    renderApp()

    act(() => {
      useToasts.getState().push('Something went wrong.')
    })

    await user.click(within(notifications()).getByRole('button', { name: 'Dismiss' }))

    await waitFor(() =>
      expect(within(notifications()).queryByRole('alert')).not.toBeInTheDocument(),
    )
  })

  it('goes away on its own after a few seconds', async () => {
    vi.useFakeTimers()
    try {
      renderApp()
      act(() => {
        useToasts.getState().push('Temporary')
      })
      expect(within(notifications()).getByRole('alert')).toBeInTheDocument()

      // The linger, then the exit transition that removes it.
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      expect(useToasts.getState().toasts).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stacks several', () => {
    renderApp()

    act(() => {
      useToasts.getState().push('First')
      useToasts.getState().push('Second')
    })

    expect(within(notifications()).getAllByRole('alert')).toHaveLength(2)
  })

  /*
    The path that matters: a store mutation refusing an action must reach the
    screen. Nothing in the board can fail today, so the refusal is produced
    directly — this proves the wiring, which is what will carry a permission
    denial once the store can say no.
  */
  it('surfaces a refused mutation', () => {
    renderApp()

    act(() => {
      notifyOnError(
        useStore.getState().moveTaskToStatus(
          'task-fix-crash',
          'status-sprint-1-todo', // belongs to another list
          0,
        ),
      )
    })

    expect(within(notifications()).getByRole('alert')).toHaveTextContent(
      'That status belongs to a different list.',
    )
    // and the task was not moved
    expect(useStore.getState().tasks['task-fix-crash'].statusId).toBe('status-bugs-open')
  })
})
