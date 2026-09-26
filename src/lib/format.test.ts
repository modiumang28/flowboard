import { describe, expect, it } from 'vitest'
import { formatDueDate, initials } from './format'

describe('initials', () => {
  it('takes the first and last initial', () => {
    expect(initials('Bob Martinez')).toBe('BM')
  })

  it('handles a single name', () => {
    expect(initials('Alice')).toBe('A')
  })

  it('ignores middle names', () => {
    expect(initials('Ada Byron Lovelace')).toBe('AL')
  })
})

describe('formatDueDate', () => {
  const now = new Date('2026-09-26T12:00:00.000Z')

  it('flags a past date as overdue', () => {
    expect(formatDueDate('2026-09-24T17:00:00.000Z', now)).toEqual({
      label: '2 days late',
      isOverdue: true,
    })
  })

  it('uses the singular for one day late', () => {
    expect(formatDueDate('2026-09-25T17:00:00.000Z', now).label).toBe('1 day late')
  })

  it('compares whole days, so earlier today is not overdue', () => {
    expect(formatDueDate('2026-09-26T08:00:00.000Z', now)).toEqual({
      label: 'Today',
      isOverdue: false,
    })
  })

  it('names tomorrow', () => {
    expect(formatDueDate('2026-09-27T17:00:00.000Z', now).label).toBe('Tomorrow')
  })

  it('uses a weekday within the week', () => {
    expect(formatDueDate('2026-09-30T17:00:00.000Z', now).label).toBe('Wed')
  })

  it('falls back to a date further out', () => {
    expect(formatDueDate('2026-11-15T17:00:00.000Z', now).label).toBe('15 Nov')
  })
})
