import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { seededState, useStore } from '../../store/store'
import { Sidebar } from './Sidebar'

/*
  What this file covers, and what it deliberately does not.

  The rules a drag must obey — siblings only, no re-parenting, where the row
  lands — are pure logic and are tested directly against resolveSiblingDrop in
  store/tree.test.ts, and against reorderContainer in store/store.test.ts.

  What is left here is the wiring: that rows are registered as sortable, that
  the ones which must not move are disabled, and that a drag renders a preview.

  Simulating the gesture itself was tried and removed. jsdom reports every
  element as 0x0 and never translates dnd-kit's collision rectangle, so the
  suite could not distinguish a correct implementation from a broken one — it
  passed more assertions against a configuration that reordered rows on an
  accidental click than against the fixed one. A harness that prefers the bug
  is worse than no harness, so the gesture is verified in a browser instead.
*/

const rowFor = (name: string) =>
  screen.getByRole('button', { name }).closest('[data-row-id]') as HTMLElement

const renderSidebar = () =>
  render(
    <MemoryRouter initialEntries={['/list']}>
      <Sidebar />
    </MemoryRouter>,
  )

beforeEach(() => {
  useStore.setState(seededState())
})

describe('Sidebar drag wiring', () => {
  it('registers every container row as sortable', () => {
    renderSidebar()
    for (const name of ['Engineering', 'Mobile App', 'Sprint 1', 'Bugs', 'Product']) {
      expect(rowFor(name)).toHaveAttribute('aria-roledescription', 'sortable')
    }
  })

  it('leaves rows that can move enabled', () => {
    renderSidebar()
    expect(rowFor('Bugs')).toHaveAttribute('aria-disabled', 'false')
    expect(rowFor('Sprint 1')).toHaveAttribute('aria-disabled', 'false')
  })

  it('disables the workspace, which has no siblings to move among', () => {
    renderSidebar()
    expect(rowFor('FoodApp')).toHaveAttribute('aria-disabled', 'true')
  })

  it('disables dragging while a row is being renamed', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Actions for Bugs' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))

    const row = screen.getByLabelText('Rename Bugs').closest('[data-row-id]')
    expect(row).toHaveAttribute('aria-disabled', 'true')
  })

  it('keeps each row reachable from the keyboard', () => {
    renderSidebar()
    expect(rowFor('Bugs')).toHaveAttribute('tabindex', '0')
  })
})
