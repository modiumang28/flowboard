import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { clearState } from '../store/persistence'
import { hydrate, seededState, useStore } from '../store/store'

/*
  The loading state, exercised against the one genuine wait the app has:
  the persistence adapter answering at boot.

  No delay is staged anywhere. Views read isReady, which starts false and
  flips when hydrate() resolves — the same flag a real fetch would drive.
*/

const renderApp = (path = '/list/list-sprint-1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  clearState()
  useStore.setState({ ...seededState(), isReady: false })
})

describe('While the store is still loading', () => {
  it('shows a skeleton instead of the tree', () => {
    renderApp()

    expect(screen.getByText('Loading workspace')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sprint 1' })).not.toBeInTheDocument()
  })

  it('shows a skeleton instead of the board', () => {
    renderApp()

    expect(screen.getByText('Loading board')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'To Do' })).not.toBeInTheDocument()
  })

  it('shows a skeleton instead of the table', () => {
    renderApp('/list/list-sprint-1?view=list')

    expect(screen.getByText('Loading tasks')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('marks the regions busy for assistive tech', () => {
    renderApp()
    const busy = document.querySelectorAll('[aria-busy="true"]')
    expect(busy.length).toBeGreaterThan(0)
  })
})

describe('Once hydration resolves', () => {
  it('replaces the skeletons with the real tree and board', async () => {
    renderApp()
    expect(screen.getByText('Loading workspace')).toBeInTheDocument()

    await hydrate()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sprint 1' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('region', { name: 'To Do' })).toBeInTheDocument()
    expect(screen.queryByText('Loading workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading board')).not.toBeInTheDocument()
  })

  it('falls back to the seed when nothing is stored', async () => {
    await hydrate()
    expect(useStore.getState().isReady).toBe(true)
    expect(useStore.getState().containers['list-sprint-1']).toBeDefined()
  })

  it('prefers what was stored over the seed', async () => {
    // Persist a workspace where a list has been renamed.
    useStore.setState(seededState())
    useStore.getState().renameContainer('list-bugs', 'Defects')
    const { isReady: _ignored, ...persisted } = useStore.getState()
    localStorage.setItem('flowboard', JSON.stringify({ version: 1, state: persisted }))

    useStore.setState({ ...seededState(), isReady: false })
    await hydrate()

    expect(useStore.getState().containers['list-bugs'].name).toBe('Defects')
  })

  it('is ready even if the stored data is unreadable', async () => {
    localStorage.setItem('flowboard', 'not json')

    await hydrate()

    expect(useStore.getState().isReady).toBe(true)
    expect(useStore.getState().containers['list-bugs'].name).toBe('Bugs')
  })
})
