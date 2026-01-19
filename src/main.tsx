import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { checkAndMigrateDataVersion } from './lib/dataVersion'

// Check data version and clear stale mock data if needed
checkAndMigrateDataVersion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
