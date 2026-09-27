import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'
import { useMemo } from 'react'
import { Avatar } from '../../components/Avatar'
import { useStore } from '../../store/store'

/*
  The brief asks for the switcher to be "obvious" and for the difference
  between two users to be demoable in seconds, so it sits at the top right as
  a named control rather than a bare avatar, and the menu shows each person's
  role — which is what actually explains why their view differs.
*/
export function UserSwitcher() {
  const users = useStore((state) => state.users)
  const currentUserId = useStore((state) => state.currentUserId)
  const setCurrentUser = useStore((state) => state.setCurrentUser)

  const userList = useMemo(() => Object.values(users), [users])
  const current = users[currentUserId]

  if (!current) return null

  return (
    <Menu>
      <MenuButton
        aria-label={`Current user: ${current.name}. Switch user`}
        className="flex cursor-pointer items-center gap-2 rounded-card py-1 pr-1.5 pl-1 text-sm transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand data-open:bg-slate-100"
      >
        <Avatar user={current} />
        <span className="font-medium text-slate-700">{current.name}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </MenuButton>

      <MenuItems
        anchor="bottom end"
        transition
        className="z-50 w-60 rounded-panel border border-line bg-white p-1 shadow-pop [--anchor-gap:6px] focus:outline-none data-closed:opacity-0"
      >
        <p className="px-2 py-1.5 text-xs text-slate-500">Viewing as</p>
        {userList.map((user) => {
          const isCurrent = user.id === currentUserId
          return (
            <MenuItem key={user.id}>
              <button
                type="button"
                onClick={() => setCurrentUser(user.id)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-card px-2 py-2 text-left transition data-focus:bg-slate-100"
              >
                <Avatar user={user} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-800">
                    {user.name}
                  </span>
                  <span className="block text-xs text-slate-500 capitalize">
                    {user.role}
                  </span>
                </span>
                {isCurrent && <Check size={15} className="shrink-0 text-brand" />}
              </button>
            </MenuItem>
          )
        })}
      </MenuItems>
    </Menu>
  )
}
