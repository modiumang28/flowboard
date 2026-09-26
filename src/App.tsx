import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { seedContainers } from './data/seed'
import { Board } from './features/board/Board'
import { Sidebar } from './features/sidebar/Sidebar'

function ListView() {
  const { listId } = useParams()
  const list = seedContainers.find((c) => c.id === listId && c.type === 'list')

  if (!list) {
    return <Empty title="List not found" body={`No list with the id "${listId}".`} />
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-6 py-5">
        <h1 className="text-lg font-semibold text-slate-900">{list.name}</h1>
      </header>
      <div className="min-h-0 flex-1">
        <Board listId={list.id} />
      </div>
    </div>
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
      <main className="min-w-0 flex-1 overflow-hidden">
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
  )
}
