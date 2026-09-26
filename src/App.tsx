import { Navigate, Route, Routes } from 'react-router-dom'

function Placeholder({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-page font-sans">
      <div className="rounded-panel border border-line bg-white px-8 py-6 shadow-card">
        <p className="text-sm font-medium text-slate-900">Flowboard</p>
        <p className="mt-1 text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/list" replace />} />
      <Route path="/list" element={<Placeholder label="No list selected" />} />
      <Route path="/list/:listId" element={<Placeholder label="List view" />} />
      <Route path="*" element={<Placeholder label="Not found" />} />
    </Routes>
  )
}
