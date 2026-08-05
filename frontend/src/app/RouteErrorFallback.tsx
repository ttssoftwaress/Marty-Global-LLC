import * as Sentry from '@sentry/react';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';

import { isStaleChunkError, reloadForStaleDeploy } from '@/lib/stale-deploy';

/*
 * The router's error screen.
 *
 * AppErrorBoundary catches render errors, but a route that fails while it is
 * still loading never reaches React's tree — React Router handles it itself,
 * and without an errorElement it renders its own developer-facing default
 * ("Unexpected Application Error!" plus a note addressed to the developer).
 * That page was reaching customers.
 *
 * The common cause is a stale deploy (lib/stale-deploy.ts), which the Vite
 * listener normally reloads before the router sees it. This is the second line:
 * if a reload has not already been tried in this tab, try it here, and
 * otherwise say plainly that a refresh is the fix.
 */

function RouteErrorScreen({ stale }: { stale: boolean }) {
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

        <h1 className="text-h5 font-semibold text-text">
          {stale ? 'A new version is available' : 'Something went wrong'}
        </h1>
        <p className="max-w-[24rem] text-body text-gray-500">
          {stale
            ? 'This page was updated while your tab was open. Refresh to load the latest version.'
            : 'This page failed to load. Our team has been notified — please try again, or head back to the homepage.'}
        </p>

        {/* No message, stack, or event id — the same rule as AppErrorBoundary. */}
        <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary h-11 rounded-input px-6 text-body"
          >
            Refresh
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

export function RouteErrorFallback() {
  const error = useRouteError();
  const stale = isStaleChunkError(error);

  useEffect(() => {
    if (stale && reloadForStaleDeploy()) return;
    // A stale chunk is an expected consequence of deploying, not a defect, so
    // only real route failures are reported.
    if (!stale) Sentry.captureException(error);
  }, [error, stale]);

  return <RouteErrorScreen stale={stale} />;
}
