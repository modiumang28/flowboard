import { Transition } from '@headlessui/react'
import { AlertCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToasts, type Toast } from '../store/toasts'

/*
  Rendered once, at the app shell. Errors are announced assertively so a
  screen reader interrupts with them — a failed action the user cannot see is
  exactly the case polite announcements would swallow.

  Each toast owns its own lifetime. The store only holds the list; how long a
  toast lingers and how it leaves are presentation, and keeping the timer here
  is also what makes the exit animation possible: the element has to stay
  mounted while it slides away, so removal happens after the transition rather
  than triggering it.
*/

/** Long enough to read a sentence, short enough not to linger. */
const LINGER_MS = 5000

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToasts((state) => state.dismiss)
  const [isShown, setIsShown] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsShown(false), LINGER_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Transition
      appear
      show={isShown}
      enter="transition duration-200 ease-out"
      enterFrom="translate-y-6 opacity-0"
      enterTo="translate-y-0 opacity-100"
      leave="transition duration-150 ease-in"
      leaveFrom="translate-y-0 opacity-100"
      leaveTo="translate-y-3 opacity-0"
      afterLeave={() => dismiss(toast.id)}
    >
      <div
        role={toast.tone === 'error' ? 'alert' : 'status'}
        className={`pointer-events-auto flex items-start gap-2.5 rounded-card border px-3 py-2.5 shadow-pop ${
          toast.tone === 'error'
            ? 'border-accent-red/20 bg-white text-accent-red'
            : 'border-line bg-white text-slate-700'
        }`}
      >
        {toast.tone === 'error' && <AlertCircle size={15} className="mt-0.5 shrink-0" />}
        <p className="flex-1 text-sm">{toast.message}</p>
        <button
          type="button"
          onClick={() => setIsShown(false)}
          aria-label="Dismiss"
          className="-mt-0.5 -mr-1 shrink-0 cursor-pointer rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <X size={14} />
        </button>
      </div>
    </Transition>
  )
}

export function Toaster() {
  const toasts = useToasts((state) => state.toasts)

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-10 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
