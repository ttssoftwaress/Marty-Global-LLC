import { RouterProvider } from 'react-router-dom'

import { AppErrorBoundary } from './app/AppErrorBoundary'
import { Providers } from './app/providers'
import { router } from './app/router'

export default function App() {
  return (
    // Outside Providers, so a throw while setting up the query client or the
    // router is caught too — a boundary nested inside them could not render its
    // own fallback if the thing that failed was an ancestor.
    <AppErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </AppErrorBoundary>
  )
}
