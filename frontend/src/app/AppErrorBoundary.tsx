import * as Sentry from '@sentry/react';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

/*
 * The app-wide error boundary.
 *
 * A render error in React 19 unmounts the whole tree — without this the
 * customer gets a blank white page with no way forward, and we never hear about
 * it. Sentry's boundary reports the error (through the scrubbing beforeSend in
 * lib/sentry.ts) and renders this fallback instead.
 *
 * It is deliberately dependency-free: no router hooks, no TanStack Query, no
 * session. Anything that could itself be the thing that just threw must not be
 * on the recovery path, which is also why "Go to homepage" is a plain anchor
 * rather than a <Link> — a full document load rebuilds the app state that the
 * failed render left behind.
 */

function ErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-dvh w-full items-center justify-center bg-gray-50 px-4 py-16"
    >
      <div className="flex w-full max-w-[28rem] flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-accent-light">
          <AlertTriangle
            className="size-6 text-accent"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </span>

        <h1 className="text-h5 font-semibold text-text">Something went wrong</h1>
        <p className="max-w-[24rem] text-body text-gray-500">
          The page failed to load. Our team has been notified — please try again,
          or head back to the homepage.
        </p>

        {/*
         * No error message, stack, or event id is rendered. A thrown API error
         * can carry a record detail in its message, and the screen is shown to
         * customers (AGENTS.md: never leak internals to the client).
         */}
        <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={resetError}
            className="btn btn-primary h-11 rounded-input px-6 text-body"
          >
            Try again
          </button>
          <a
            href="/"
            className="btn btn-secondary h-11 rounded-input px-6 text-body"
          >
            Go to homepage
          </a>
        </div>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
