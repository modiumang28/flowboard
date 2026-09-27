import { create } from 'zustand'
import { isError, type Result } from '../lib/result'

/*
  Toasts live in their own store, not the domain one. They are transient UI
  state: nothing here should be persisted, undone, or reasoned about as part
  of the workspace.

  When to reach for a toast rather than an inline banner: use a banner when
  there is somewhere obvious to put it — a form field that failed validation,
  say — and a toast when the action has no home on screen. Dragging a card is
  the clearest case; there is no panel to report into once the pointer is
  released.
*/

export interface Toast {
  id: string
  message: string
  tone: 'error' | 'info'
}

interface ToastStore {
  toasts: Toast[]
  push: (message: string, tone?: Toast['tone']) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToasts = create<ToastStore>()((set) => ({
  toasts: [],

  /* How long a toast lingers is presentation, so the Toaster owns the timer
     and calls dismiss once its exit animation has finished. */
  push(message, tone = 'error') {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    return id
  },

  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },

  clear() {
    set({ toasts: [] })
  },
}))

/**
 * Surfaces a failed mutation and reports whether it failed, so a caller can
 * both notify and branch in one line:
 *
 *   if (notifyOnError(moveTaskToStatus(...))) return
 */
export function notifyOnError<T>(result: Result<T>): boolean {
  if (!isError(result)) return false
  useToasts.getState().push(result.error.message)
  return true
}
