import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { router } from './app/router'
import { installVersionWatcher } from './lib/app-version'
import { initSentry } from './lib/sentry'
import { installStaleDeployReload } from './lib/stale-deploy'
import './styles/index.css'

// Before the first render, so an error thrown while mounting the tree is still
// reported. No-ops without VITE_SENTRY_DSN.
initSentry()

// Also before the first render: the very first route chunk can be the one a
// deploy replaced.
installStaleDeployReload()

// Picks up a release on the next navigation, so a long-lived tab moves onto the
// new build instead of waiting to break on a chunk that is gone.
installVersionWatcher(router)

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
