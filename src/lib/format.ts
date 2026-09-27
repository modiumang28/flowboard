/* Display helpers. Dates use the platform's Intl rather than a date library. */

/** "Bob Martinez" -> "BM", "Alice" -> "A". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const fullFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Unambiguous date for the drawer, where there is room for it. */
export function formatFullDate(iso: string): string {
  return fullFormat.format(new Date(iso))
}

/** ISO datetime -> the yyyy-mm-dd an <input type="date"> expects. */
export function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** yyyy-mm-dd back to an ISO datetime, due at the end of that day. */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 17, 0, 0).toISOString()
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export interface DueDate {
  label: string
  isOverdue: boolean
}

/**
 * Turns an ISO date into something scannable on a card. Relative wording only
 * where it needs no working out — "2 days late", "Today", "Tomorrow". Anything
 * further out is a plain date: a weekday such as "Thu" leaves the reader asking
 * which Thursday.
 */
export function formatDueDate(iso: string, now = new Date()): DueDate {
  const due = new Date(iso)
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000)

  if (days < 0) {
    const overdueBy = Math.abs(days)
    return {
      label: overdueBy === 1 ? '1 day late' : `${overdueBy} days late`,
      isOverdue: true,
    }
  }
  if (days === 0) return { label: 'Today', isOverdue: false }
  if (days === 1) return { label: 'Tomorrow', isOverdue: false }
  return { label: dayFormat.format(due), isOverdue: false }
}
