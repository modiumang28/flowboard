import { ACCENT_TEXT, ACCENT_TINT } from '../lib/accents'
import { initials } from '../lib/format'
import type { User } from '../types'

export function Avatar({ user }: { user: User }) {
  return (
    <span
      title={user.name}
      className={`inline-grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold ring-2 ring-white ${ACCENT_TINT[user.avatarColor]} ${ACCENT_TEXT[user.avatarColor]}`}
    >
      {initials(user.name)}
    </span>
  )
}

/** Overlapping stack, capped so a busy card stays scannable. */
export function AvatarGroup({ users, max = 3 }: { users: User[]; max?: number }) {
  if (users.length === 0) return null

  const shown = users.slice(0, max)
  const overflow = users.length - shown.length

  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((user) => (
        <Avatar key={user.id} user={user} />
      ))}
      {overflow > 0 && (
        <span className="inline-grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 ring-2 ring-white">
          +{overflow}
        </span>
      )}
    </span>
  )
}
