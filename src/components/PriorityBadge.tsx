import { ACCENT_TEXT, ACCENT_TINT, PRIORITY_ACCENT, PRIORITY_LABEL } from '../lib/accents'
import type { Priority } from '../types'

/**
 * Renders nothing for `none`. An explicit "None" badge on every unprioritised
 * card is noise, and the point of the badge is that it stands out.
 */
export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === 'none') return null

  const accent = PRIORITY_ACCENT[priority]

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${ACCENT_TINT[accent]} ${ACCENT_TEXT[accent]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
