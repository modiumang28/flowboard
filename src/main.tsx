import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { subscribeToPersistence } from './store/persistence.ts'
import { useStore } from './store/store.ts'

// Persistence is attached here, outside the store, so nothing in the data
// layer knows where its data ends up.
subscribeToPersistence(useStore)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
