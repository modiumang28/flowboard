import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { Board } from './features/board/Board'
import { Sidebar } from './features/sidebar/Sidebar'
import { TopBar } from './features/shell/TopBar'
import { TaskDrawer } from './features/task/TaskDrawer'
import { useStore } from './store/store'

function ListView() {
  const { listId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const list = useStore((state) => (listId ? state.containers[listId] : undefined))

  if (!list || list.type !== 'list' || list.archivedAt !== null) {
    return <Empty title="List not found" body={`No list with the id “${listId}”.`} />
  }

  // The open task lives in the URL, so the back button closes the drawer and
  // a link to a task can be shared.
  const openTaskId = searchParams.get('task')

  return (
    <>
      <Board listId={list.id} />
      <TaskDrawer taskId={openTaskId} onClose={() => setSearchParams({})} />
    </>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{body}</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="flex h-screen bg-page font-sans text-slate-900 antialiased">
      <Sidebar />

      {/* Top bar spans the main area only, so the sidebar reads as its own
          column rather than being cut across by the header. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-hidden pt-4">
          <Routes>
            <Route path="/" element={<Navigate to="/list" replace />} />
            <Route
              path="/list"
              element={
                <Empty
                  title="No list selected"
                  body="Pick a list from the sidebar to get started."
                />
              }
            />
            <Route path="/list/:listId" element={<ListView />} />
            <Route
              path="*"
              element={<Empty title="Page not found" body="That URL does not exist." />}
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}
