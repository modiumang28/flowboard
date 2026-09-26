/* Display helpers. Dates use the platform's Intl rather than a date library. */

/** "Bob Martinez" -> "BM", "Alice" -> "A". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export interface DueDate {
  label: string
  isOverdue: boolean
}

/**
 * Turns an ISO date into something scannable on a card. Relative wording for
 * the near term, because "2 days late" reads faster than a date you have to
 * compare against today yourself.
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
  if (days < 7) return { label: weekdayFormat.format(due), isOverdue: false }
  return { label: dayFormat.format(due), isOverdue: false }
}
