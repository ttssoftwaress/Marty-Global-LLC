import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initSentry } from './lib/sentry'
import { installStaleDeployReload } from './lib/stale-deploy'
import './styles/index.css'

// Before the first render, so an error thrown while mounting the tree is still
// reported. No-ops without VITE_SENTRY_DSN.
initSentry()

// Also before the first render: the very first route chunk can be the one a
// deploy replaced.
installStaleDeployReload()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
