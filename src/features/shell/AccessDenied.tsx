import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'

/*
  The 403. It names the identity being refused, because the fix is almost
  always "you are looking at this as the wrong person" — and with a user
  switcher in the top bar that is a one-click fix, not something to go and ask
  an admin about.

  It also offers a way out. A dead end with no action leaves the main area
  blank until the user works out that the sidebar is still usable.
*/
export function AccessDenied() {
  const navigate = useNavigate()
  const user = useStore((state) => state.users[state.currentUserId])

  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-red/10 text-accent-red">
          <Lock size={20} />
        </span>

        <h1 className="mt-4 text-base font-semibold text-slate-900">
          You don’t have access to this list
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          {user ? (
            <>
              You’re viewing as{' '}
              <span className="font-medium text-slate-700">{user.name}</span>, who is a{' '}
              {user.role}. Switch user in the top bar, or ask an admin for access.
            </>
          ) : (
            'Ask an admin for access, or switch to a user who has it.'
          )}
        </p>

        <button
          type="button"
          onClick={() => navigate('/list')}
          className="mt-5 cursor-pointer rounded-card border border-line bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-card transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          Back to your lists
        </button>
      </div>
    </div>
  )
}
