import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { checkAndMigrateDataVersion } from './lib/dataVersion'

// Check data version and clear stale mock data if needed
checkAndMigrateDataVersion()

// Phase 18: Register service worker for PWA (skip in dev — SW intercepts GETs and breaks
// localhost when the cache misses or the dev server restarts; operators can still test PWA via preview/prod)
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=2').catch((err) => {
      console.log('SW registration failed:', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
