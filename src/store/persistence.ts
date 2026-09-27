import type { StoreState } from './store'

/*
  The localStorage adapter.

  Two functions, load and save — the same shape an API client would have, so
  swapping this file for a real backend would not touch the store, the
  selectors or any component.

  It is wired up as a *subscriber* (see subscribeToPersistence below) rather
  than being called at the end of each action. One watcher cannot be forgotten
  the way one of twenty save calls can.
*/

const KEY = 'flowboard'

/**
 * Bump when the shape of StoreState changes. Saved data from an older shape is
 * discarded and the app reseeds, instead of loading data the code can no
 * longer read.
 */
const VERSION = 1

/** Readiness describes this adapter's own progress, so it is never stored. */
type PersistedState = Omit<StoreState, 'isReady'>

interface Envelope {
  version: number
  state: PersistedState
}

/*
  Async on purpose. Reading localStorage is synchronous, but an API client
  would not be — and this is the seam that would be swapped for one. Keeping
  the signature promise-shaped means the loading state is a real await rather
  than a staged delay, and nothing above has to change the day a backend
  appears.
*/
export async function loadState(): Promise<PersistedState | null> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const envelope = JSON.parse(raw) as Partial<Envelope>
    if (envelope.version !== VERSION || !envelope.state) {
      localStorage.removeItem(KEY)
      return null
    }
    return envelope.state
  } catch {
    // Corrupt or unreadable — fall back to the seed rather than crash on boot.
    localStorage.removeItem(KEY)
    return null
  }
}

export function saveState(state: PersistedState): void {
  try {
    const envelope: Envelope = { version: VERSION, state }
    localStorage.setItem(KEY, JSON.stringify(envelope))
  } catch {
    // Quota or private-mode failures should not break the app.
  }
}

export function clearState(): void {
  localStorage.removeItem(KEY)
}

/** Only entities are persisted — never UI state such as which drawer is open. */
function persistable(state: StoreState): PersistedState {
  return {
    containers: state.containers,
    statuses: state.statuses,
    tasks: state.tasks,
    users: state.users,
    grants: state.grants,
    currentUserId: state.currentUserId,
  }
}

type Subscribable = {
  subscribe: (listener: (state: StoreState) => void) => () => void
}

/** Watches the store and writes on every change. The actions know nothing about this. */
export function subscribeToPersistence(store: Subscribable): () => void {
  return store.subscribe((state) => saveState(persistable(state)))
}
