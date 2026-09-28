import { DndContext } from '@dnd-kit/core'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildBoard } from '../../store/board'
import { seededState, useStore } from '../../store/store'
import { BoardColumn } from './BoardColumn'

/*
  The placeholder shows the space a card dragged in from another column would
  occupy. Within a column the sorting strategy already opens a real gap, so it
  is suppressed there to avoid two indicators saying the same thing.

  The gesture that produces it cannot be simulated in jsdom — dnd-kit resolves
  drops by geometry and jsdom reports every element as 0x0 — so the position
  is driven by a prop here and tested on that.
*/

const column = () => {
  const { statuses, tasks } = useStore.getState()
  return buildBoard(Object.values(statuses), Object.values(tasks), 'list-bugs')[0]
}

const renderColumn = (insertAt: number, isDropTarget = true) =>
  render(
    <MemoryRouter>
      <DndContext>
        <BoardColumn
          column={column()}
          users={Object.values(useStore.getState().users)}
          isDropTarget={isDropTarget}
          insertAt={insertAt}
        />
      </DndContext>
    </MemoryRouter>,
  )

/** Decorative, so it is aria-hidden rather than in the accessibility tree. */
const placeholders = () => document.querySelectorAll('[aria-hidden="true"].border-dashed')

beforeEach(() => {
  useStore.setState(seededState())
})

describe('The cross-column drop placeholder', () => {
  it('is absent when nothing is being dragged in', () => {
    renderColumn(-1, false)
    expect(placeholders()).toHaveLength(0)
  })

  it('appears once when a landing position is known', () => {
    renderColumn(0)
    expect(placeholders()).toHaveLength(1)
  })

  it('sits above the card it would push down', () => {
    renderColumn(1)

    const region = screen.getByRole('region', { name: 'Open' })
    const headings = within(region).getAllByRole('heading', { level: 3 })
    const placeholder = placeholders()[0]

    // Document order: first card, then the placeholder, then the second card.
    expect(
      headings[0].compareDocumentPosition(placeholder) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      headings[1].compareDocumentPosition(placeholder) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy()
  })

  it('sits after the last card when dropping at the end', () => {
    const cards = column().tasks.length
    renderColumn(cards)

    const region = screen.getByRole('region', { name: 'Open' })
    const headings = within(region).getAllByRole('heading', { level: 3 })
    const placeholder = placeholders()[0]

    expect(
      headings[headings.length - 1].compareDocumentPosition(placeholder) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('does not double up — only ever one placeholder at a time', () => {
    renderColumn(1)
    expect(placeholders()).toHaveLength(1)
  })

  it('leaves the cards themselves untouched', () => {
    renderColumn(0)
    const region = screen.getByRole('region', { name: 'Open' })
    expect(within(region).getAllByRole('heading', { level: 3 })).toHaveLength(
      column().tasks.length,
    )
  })
})
